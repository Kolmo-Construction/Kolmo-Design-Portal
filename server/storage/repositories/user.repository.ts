// server/storage/repositories/user.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db'; // Adjust path as necessary
import { hashPassword } from '../../auth'; // Adjust path
import { HttpError } from '../../errors'; // Adjust path
import { UserProfile, ClientInfo } from '../types'; // Import shared types

// Interface for User Repository
export interface IUserRepository {
    findUserByEmail(email: string): Promise<schema.User | null>;
    getUserById(userId: string): Promise<schema.User | null>;
    getUserProfileById(userId: string): Promise<UserProfile | null>;
    getAllUsersWithRoleClient(): Promise<ClientInfo[]>;
    createUser(userData: schema.InsertUser): Promise<UserProfile | null>;
    setupUserProfile(userId: string, firstName: string, lastName: string, password: string): Promise<UserProfile | null>;
    storeMagicLinkToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
    findUserByMagicLinkToken(tokenHash: string): Promise<{ userId: string, expiresAt: Date } | null>;
    deleteMagicLinkToken(tokenHash: string): Promise<void>;
}

// Implementation
class UserRepository implements IUserRepository {
    private db: NeonDatabase<typeof schema>;

    // Allow injecting db instance for testing, default to imported db
    constructor(database: NeonDatabase<typeof schema> = db) {
        this.db = database;
    }

    async findUserByEmail(email: string): Promise<schema.User | null> {
        try {
            const result = await this.db.query.users.findFirst({
                where: eq(schema.users.email, email.toLowerCase()),
            });
            return result ?? null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            throw new Error('Database error while finding user.');
        }
    }

    async getUserById(userId: string): Promise<schema.User | null> {
         try {
            const result = await this.db.query.users.findFirst({
                where: eq(schema.users.id, userId),
            });
            return result ?? null;
        } catch (error) {
            console.error(`Error getting user by ID (${userId}):`, error);
            throw new Error('Database error while getting user.');
        }
    }

    async getUserProfileById(userId: string): Promise<UserProfile | null> {
        try {
            const result = await this.db.select({
                id: schema.users.id,
                firstName: schema.users.firstName,
                lastName: schema.users.lastName,
                email: schema.users.email,
                role: schema.users.role,
                createdAt: schema.users.createdAt,
                updatedAt: schema.users.updatedAt,
                profileComplete: schema.users.profileComplete,
            })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error(`Error getting user profile by ID (${userId}):`, error);
            throw new Error('Database error while getting user profile.');
        }
    }

     async getAllUsersWithRoleClient(): Promise<ClientInfo[]> {
        try {
            return await this.db.select({
                id: schema.users.id,
                firstName: schema.users.firstName,
                lastName: schema.users.lastName,
                email: schema.users.email,
            })
            .from(schema.users)
            .where(eq(schema.users.role, 'CLIENT'))
            .orderBy(asc(schema.users.lastName), asc(schema.users.firstName));
        } catch (error) {
            console.error('Error getting client users:', error);
            throw new Error('Database error while fetching clients.');
        }
    }

     async createUser(userData: schema.InsertUser): Promise<UserProfile | null> {
        const emailLower = userData.email.toLowerCase();
        try {
            const passwordHash = userData.passwordHash ? await hashPassword(userData.passwordHash) : null;
            const result = await this.db.insert(schema.users)
                .values({
                    ...userData,
                    email: emailLower,
                    passwordHash: passwordHash,
                })
                .returning({
                    id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName,
                    email: schema.users.email, role: schema.users.role, createdAt: schema.users.createdAt,
                    updatedAt: schema.users.updatedAt, profileComplete: schema.users.profileComplete,
                });
            return result.length > 0 ? result[0] : null;
        } catch (error: any) {
            console.error('Error creating user:', error);
            if (error.code === '23505' && error.constraint === 'users_email_unique') {
                throw new HttpError(409, 'User with this email already exists.');
            }
            throw new Error('Database error while creating user.');
        }
    }

   async setupUserProfile(userId: string, firstName: string, lastName: string, password: string): Promise<UserProfile | null> {
       try {
           const passwordHash = await hashPassword(password);
           const result = await this.db.update(schema.users)
                .set({ firstName, lastName, passwordHash, profileComplete: true, updatedAt: new Date() })
                .where(eq(schema.users.id, userId))
                .returning({
                    id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName,
                    email: schema.users.email, role: schema.users.role, createdAt: schema.users.createdAt,
                    updatedAt: schema.users.updatedAt, profileComplete: schema.users.profileComplete,
               });
           return result.length > 0 ? result[0] : null;
       } catch (error) {
            console.error(`Error setting up profile for user ${userId}:`, error);
            throw new Error('Database error while setting up profile.');
       }
   }

   async storeMagicLinkToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        try {
            await this.db.update(schema.users)
                .set({ magicLinkToken: tokenHash, magicLinkExpiresAt: expiresAt, updatedAt: new Date() })
                .where(eq(schema.users.id, userId));
        } catch (error) {
            console.error(`Error storing magic link token for user ${userId}:`, error);
            throw new Error('Database error while storing magic link token.');
        }
    }

    async findUserByMagicLinkToken(tokenHash: string): Promise<{ userId: string, expiresAt: Date } | null> {
         try {
            const result = await this.db.select({ userId: schema.users.id, expiresAt: schema.users.magicLinkExpiresAt })
                .from(schema.users)
                .where(eq(schema.users.magicLinkToken, tokenHash))
                .limit(1);

            if (result.length > 0) {
                if (!result[0].expiresAt || result[0].expiresAt < new Date()) { return null; } // Expired
                return result[0];
            }
            return null;
        } catch (error) {
            console.error(`Error finding user by magic link token hash:`, error);
            throw new Error('Database error while verifying magic link token.');
        }
    }

    async deleteMagicLinkToken(tokenHash: string): Promise<void> {
        try {
             await this.db.update(schema.users)
                .set({ magicLinkToken: null, magicLinkExpiresAt: null, updatedAt: new Date() })
                .where(eq(schema.users.magicLinkToken, tokenHash));
        } catch (error) {
            console.error(`Error deleting magic link token hash:`, error);
            // Log only, don't throw
        }
    }
}

// Export an instance for convenience
export const userRepository = new UserRepository();