import { Router } from "express";
import multer from "multer";
import { isAuthenticated } from "../middleware/auth.middleware";
import { DesignProposalController } from "../controllers/design-proposal.controller";

const router = Router();
const controller = new DesignProposalController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.get("/", isAuthenticated, controller.getAllProposals.bind(controller));
router.post("/", isAuthenticated, controller.createProposal.bind(controller));

router.get("/public/:token", controller.getProposalByToken.bind(controller));

router.get("/:id", isAuthenticated, controller.getProposalById.bind(controller));
router.patch("/:id", isAuthenticated, controller.updateProposal.bind(controller));
router.delete("/:id", isAuthenticated, controller.deleteProposal.bind(controller));

router.post("/comparisons", isAuthenticated, controller.createComparison.bind(controller));
router.patch("/comparisons/:id", isAuthenticated, controller.updateComparison.bind(controller));
router.delete("/comparisons/:id", isAuthenticated, controller.deleteComparison.bind(controller));

// Gallery image routes
router.get("/:proposalId/gallery", controller.getGalleryImages.bind(controller)); // Public access
router.post("/gallery", upload.single('image'), controller.createGalleryImage.bind(controller)); // Public upload allowed
router.patch("/gallery/:id", isAuthenticated, controller.updateGalleryImage.bind(controller));
router.delete("/gallery/:id", isAuthenticated, controller.deleteGalleryImage.bind(controller));

// Comment routes
router.get("/gallery/:imageId/comments", controller.getImageComments.bind(controller)); // Public access
router.post("/gallery/comments", controller.createComment.bind(controller)); // Public comments allowed
router.delete("/gallery/comments/:id", isAuthenticated, controller.deleteComment.bind(controller));

// Favorite routes
router.post("/gallery/favorites", controller.toggleFavorite.bind(controller)); // Public favorites allowed
router.get("/gallery/:imageId/favorites", controller.getImageFavorites.bind(controller)); // Public access

export default router;
