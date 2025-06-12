// server/storage/repositories/user.repository.ts
import { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { eq, and, or, sql, desc, asc } from 'drizzle-orm';
import * as schema from '../../../shared/schema';
import { db } from '../../db'; // Adjust path as necessary
// Import hashPassword dynamically to avoid circular dependencies
import { HttpError } from '../../errors'; // Adjust path
import { UserProfile, ClientInfo } from '../types'; // Import shared types

// Interface for User Repository
export interface IUserRepository {
    findUserByEmail(email: string): Promise<schema.User | null>;
    getUserById(userId: string): Promise<schema.User | null>;
    getUserProfileById(userId: string): Promise<UserProfile | null>;
    getAllUsersWithRoleClient(): Promise<ClientInfo[]>;
    createUser(userData: schema.InsertUser): Promise<schema.User>;
    setupUserProfile(userId: string, firstName: string, lastName: string, password: string): Promise<UserProfile | null>;
    storeMagicLinkToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
    findUserByMagicLinkToken(tokenHash: string): Promise<{ userId: string, expiresAt: Date } | null>;
    deleteMagicLinkToken(tokenHash: string): Promise<void>;
    
    // Methods needed for backward compatibility with the old storage
    getUser(id: number): Promise<schema.User | null>;
    getUserByUsername(username: string): Promise<schema.User | null>;
    getUserByEmail(email: string): Promise<schema.User | null>;
    getUserByMagicLinkToken(token: string): Promise<schema.User | null>;
    updateUser(id: number, userData: Partial<schema.InsertUser>): Promise<schema.User>;
    updateUserMagicLinkToken(id: number, token: string | null, expiry: Date | null): Promise<schema.User>;
    getAllUsers(): Promise<schema.User[]>;
    deleteUser(id: number): Promise<boolean>;
}

// Implementation
class UserRepository implements IUserRepository {
    private db: NeonDatabase<typeof schema>;
    private queryCache = new Map<string, Promise<any>>();
    private cacheTimeout = 5000; // 5 seconds cache for auth queries

    // Allow injecting db instance for testing, default to imported db
    constructor(database: NeonDatabase<typeof schema> = db) {
        this.db = database;
    }

    private getCachedQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
        const cached = this.queryCache.get(key);
        if (cached) {
            return cached as Promise<T>;
        }

        const promise = queryFn().finally(() => {
            // Clear cache after timeout
            setTimeout(() => {
                this.queryCache.delete(key);
            }, this.cacheTimeout);
        });

        this.queryCache.set(key, promise);
        return promise;
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
        const cacheKey = `user:id:${userId}`;
        return this.getCachedQuery(cacheKey, async () => {
            try {
                const numericUserId = parseInt(userId, 10);
                const result = await this.db.query.users.findFirst({
                    where: eq(schema.users.id, numericUserId),
                });
                return result ?? null;
            } catch (error) {
                console.error(`Error getting user by ID (${userId}):`, error);
                throw new Error('Database error while getting user.');
            }
        });
    }

    async getUserProfileById(userId: string): Promise<UserProfile | null> {
        try {
            const numericUserId = parseInt(userId, 10);
            const result = await this.db.select({
                id: schema.users.id,
                firstName: schema.users.firstName,
                lastName: schema.users.lastName,
                email: schema.users.email,
                username: schema.users.username,
                role: schema.users.role,
                phone: schema.users.phone,
                createdAt: schema.users.createdAt,
                updatedAt: schema.users.updatedAt,
                isActivated: schema.users.isActivated,
                stripeCustomerId: schema.users.stripeCustomerId,
                stripeSubscriptionId: schema.users.stripeSubscriptionId,
            })
            .from(schema.users)
            .where(eq(schema.users.id, numericUserId))
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
            .where(eq(schema.users.role, 'client'))
            .orderBy(asc(schema.users.lastName), asc(schema.users.firstName));
        } catch (error) {
            console.error('Error getting client users:', error);
            throw new Error('Database error while fetching clients.');
        }
    }

     async createUser(userData: schema.InsertUser): Promise<schema.User> {
        const emailLower = userData.email.toLowerCase();
        try {
            // If we have passwordHash, use it, otherwise use the password directly
            const { hashPassword } = await import('../../auth');
            const hashedPassword = userData.password ? await hashPassword(userData.password) : null;
            
            const result = await this.db.insert(schema.users)
                .values({
                    ...userData,
                    email: emailLower,
                    password: hashedPassword || userData.password,
                })
                .returning();
                
            if (result.length === 0) {
                throw new Error('Failed to create user: no result returned.');
            }
            return result[0];
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
           const { hashPassword } = await import('../../auth');
           const hashedPassword = await hashPassword(password);
           const numericUserId = parseInt(userId, 10);
           const result = await this.db.update(schema.users)
                .set({ firstName, lastName, password: hashedPassword, isActivated: true, updatedAt: new Date() })
                .where(eq(schema.users.id, numericUserId))
                .returning({
                    id: schema.users.id, 
                    firstName: schema.users.firstName, 
                    lastName: schema.users.lastName,
                    email: schema.users.email, 
                    username: schema.users.username,
                    role: schema.users.role, 
                    phone: schema.users.phone,
                    createdAt: schema.users.createdAt,
                    updatedAt: schema.users.updatedAt,
                    isActivated: schema.users.isActivated,
                    stripeCustomerId: schema.users.stripeCustomerId,
                    stripeSubscriptionId: schema.users.stripeSubscriptionId,
               });
           return result.length > 0 ? result[0] : null;
       } catch (error) {
            console.error(`Error setting up profile for user ${userId}:`, error);
            throw new Error('Database error while setting up profile.');
       }
   }

   async storeMagicLinkToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
        try {
            const numericUserId = parseInt(userId, 10);
            await this.db.update(schema.users)
                .set({ magicLinkToken: tokenHash, magicLinkExpiry: expiresAt, updatedAt: new Date() })
                .where(eq(schema.users.id, numericUserId));
        } catch (error) {
            console.error(`Error storing magic link token for user ${userId}:`, error);
            throw new Error('Database error while storing magic link token.');
        }
    }

    async findUserByMagicLinkToken(tokenHash: string): Promise<{ userId: string, expiresAt: Date } | null> {
         try {
            const result = await this.db.select({ 
                userId: schema.users.id, 
                expiresAt: schema.users.magicLinkExpiry 
            })
            .from(schema.users)
            .where(eq(schema.users.magicLinkToken, tokenHash))
            .limit(1);

            if (result.length > 0) {
                if (!result[0].expiresAt || result[0].expiresAt < new Date()) { return null; } // Expired
                // Convert number ID to string for consistent API
                return { 
                    userId: result[0].userId.toString(),
                    expiresAt: result[0].expiresAt
                };
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
                .set({ magicLinkToken: null, magicLinkExpiry: null, updatedAt: new Date() })
                .where(eq(schema.users.magicLinkToken, tokenHash));
        } catch (error) {
            console.error(`Error deleting magic link token hash:`, error);
            // Log only, don't throw
        }
    }

    // Methods for backward compatibility with the old storage
    async getUser(id: number): Promise<schema.User | null> {
        return this.getUserById(id.toString());
    }

    async getUserByUsername(username: string): Promise<schema.User | null> {
        try {
            const result = await this.db.query.users.findFirst({
                where: eq(schema.users.username, username),
            });
            return result ?? null;
        } catch (error) {
            console.error(`Error getting user by username (${username}):`, error);
            throw new Error('Database error while getting user by username.');
        }
    }

    async getUserByEmail(email: string): Promise<schema.User | null> {
        return this.findUserByEmail(email);
    }

    async getUserByMagicLinkToken(token: string): Promise<schema.User | null> {
        try {
            const result = await this.db.query.users.findFirst({
                where: eq(schema.users.magicLinkToken, token),
            });
            return result ?? null;
        } catch (error) {
            console.error(`Error getting user by magic link token:`, error);
            throw new Error('Database error while getting user by magic link token.');
        }
    }

    async updateUser(id: number, userData: Partial<schema.InsertUser>): Promise<schema.User> {
        try {
            const result = await this.db.update(schema.users)
                .set({ ...userData, updatedAt: new Date() })
                .where(eq(schema.users.id, id))
                .returning();
            
            if (result.length === 0) {
                throw new Error(`User with ID ${id} not found.`);
            }
            return result[0];
        } catch (error) {
            console.error(`Error updating user (${id}):`, error);
            throw new Error('Database error while updating user.');
        }
    }

    async updateUserMagicLinkToken(id: number, token: string | null, expiry: Date | null): Promise<schema.User> {
        try {
            const result = await this.db.update(schema.users)
                .set({ 
                    magicLinkToken: token, 
                    magicLinkExpiry: expiry,
                    updatedAt: new Date() 
                })
                .where(eq(schema.users.id, id))
                .returning();
            
            if (result.length === 0) {
                throw new Error(`User with ID ${id} not found.`);
            }
            return result[0];
        } catch (error) {
            console.error(`Error updating user magic link token (${id}):`, error);
            throw new Error('Database error while updating user magic link token.');
        }
    }

    async getAllUsers(): Promise<schema.User[]> {
        try {
            return await this.db.query.users.findMany();
        } catch (error) {
            console.error('Error getting all users:', error);
            throw new Error('Database error while getting all users.');
        }
    }

    async deleteUser(id: number): Promise<boolean> {
        try {
            const result = await this.db.delete(schema.users)
                .where(eq(schema.users.id, id));
            
            // Check if any rows were affected
            return result.rowCount !== null && result.rowCount > 0;
        } catch (error) {
            console.error(`Error deleting user (${id}):`, error);
            throw new Error('Database error while deleting user.');
        }
    }
}

// Export an instance for convenience
export const userRepository = new UserRepository();