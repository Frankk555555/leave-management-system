const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getSupervisors,
  updateProfile,
  updateProfileImage,
  updateSignatureImage,
  resetUserPassword,
  importUsers,
  previewDbSync,
  executeDbSync,
  previewApiSync,
  executeApiSync,
  getMockUniversityApi,
  setupMockDb,
  previewImportFile,
  downloadImportTemplate,
} = require("../controllers/userController");
const { protect, admin } = require("../middleware/auth");
const validateFileSignature = require("../middleware/validateFileSignature");

const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Helper middleware to catch multer upload errors and return 400 Bad Request
const handleUploadError = (uploadMiddleware, fileTypeName = "รูปภาพ") => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ message: "ขนาดไฟล์ต้องไม่เกิน 5MB" });
          }
          return res
            .status(400)
            .json({ message: `ข้อผิดพลาดในการอัปโหลด: ${err.message}` });
        }
        return res
          .status(400)
          .json({ message: err.message || `เกิดข้อผิดพลาดในการอัปโหลด${fileTypeName}` });
      }
      next();
    });
  };
};

let profileStorage;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
  profileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      try {
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
      } catch (e) {
        // Fallback
      }
      const rawExt = (path.extname(file.originalname).toLowerCase() || ".jpg").replace(/^\./, "");
      const ext = rawExt === "jpeg" || rawExt === "jfif" ? "jpg" : rawExt;
      const validFormats = ["jpg", "png", "gif", "webp"];
      const cleanFormat = validFormats.includes(ext) ? ext : "jpg";
      const userId = req.user?.id || "unknown";
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      return {
        folder: "leave_management/profiles",
        resource_type: "image",
        access_mode: "public",
        public_id: `profile-${userId}-${uniqueSuffix}`,
        format: cleanFormat,
      };
    },
  });
} else {
  const profileDir = "uploads/profiles/";
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, profileDir);
    },
    filename: (req, file, cb) => {
      try {
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
      } catch (e) {}
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`
      );
    },
  });
}

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpe?g|png|gif|webp|jfif)$/i;
    const isExtValid = allowedExts.test(file.originalname);
    const isMimeValid =
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/octet-stream";

    if (isExtValid || isMimeValid) {
      return cb(null, true);
    }
    cb(new Error("รองรับเฉพาะไฟล์รูปภาพ (JPG, JPEG, PNG, GIF, WEBP, JFIF)"));
  },
});

let signatureStorage;

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
  signatureStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      try {
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
      } catch (e) {}
      const rawExt = (path.extname(file.originalname).toLowerCase() || ".png").replace(/^\./, "");
      const ext = rawExt === "jpeg" || rawExt === "jfif" ? "jpg" : rawExt;
      const validFormats = ["jpg", "png", "webp"];
      const cleanFormat = validFormats.includes(ext) ? ext : "png";
      const userId = req.user?.id || "unknown";
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      return {
        folder: "leave_management/signatures",
        resource_type: "image",
        access_mode: "public",
        public_id: `sig-${userId}-${uniqueSuffix}`,
        format: cleanFormat,
      };
    },
  });
} else {
  const signatureDir = "uploads/signatures/";
  if (!fs.existsSync(signatureDir)) {
    fs.mkdirSync(signatureDir, { recursive: true });
  }
  signatureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, signatureDir);
    },
    filename: (req, file, cb) => {
      try {
        file.originalname = Buffer.from(file.originalname, "latin1").toString("utf8");
      } catch (e) {}
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        `sig-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`
      );
    },
  });
}

const uploadSignature = multer({
  storage: signatureStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpe?g|png|webp)$/i;
    const isExtValid = allowedExts.test(file.originalname);
    const isMimeValid =
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/octet-stream";

    if (isExtValid || isMimeValid) {
      return cb(null, true);
    }
    cb(new Error("รองรับเฉพาะไฟล์รูปภาพ (JPG, JPEG, PNG, WEBP)"));
  },
});

// Multer config for import files (CSV/Excel)
const importDir = "uploads/imports/";
if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
}

const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, importDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const uploadImport = multer({
  storage: importStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (extname) {
      return cb(null, true);
    }
    cb(new Error("รองรับเฉพาะไฟล์ .csv, .xlsx, .xls"));
  },
});

// Profile routes (for logged-in users to edit their own profile)
router.put("/profile", protect, updateProfile);
router.put(
  "/profile/image",
  protect,
  handleUploadError(uploadProfile.single("profileImage"), "รูปโปรไฟล์"),
  validateFileSignature("image"),
  updateProfileImage
);
router.put(
  "/profile/signature",
  protect,
  handleUploadError(uploadSignature.single("signatureImage"), "รูปลายเซ็นต์"),
  validateFileSignature("signature"),
  updateSignatureImage
);

router.post(
  "/import",
  protect,
  admin,
  handleUploadError(uploadImport.single("file"), "ไฟล์นำเข้า"),
  validateFileSignature("import"),
  importUsers
);
router.post(
  "/import-preview",
  protect,
  admin,
  handleUploadError(uploadImport.single("file"), "ไฟล์นำเข้า"),
  validateFileSignature("import"),
  previewImportFile
);
router.get("/import-template", protect, admin, downloadImportTemplate);

// Database/API import and sync routes (Admin only)
router.post("/import-db-preview", protect, admin, previewDbSync);
router.post("/import-db-sync", protect, admin, executeDbSync);
router.post("/import-api-preview", protect, admin, previewApiSync);
router.post("/import-api-sync", protect, admin, executeApiSync);
router.post("/setup-mock-db", protect, admin, setupMockDb);
router.get("/mock-university-api", getMockUniversityApi);

router.get("/supervisors", protect, getSupervisors); // Protected - requires authentication
router
  .route("/")
  .get(protect, admin, getUsers)
  .post(protect, admin, createUser);

router
  .route("/:id")
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

// Admin reset password route
router.put("/:id/reset-password", protect, admin, resetUserPassword);

module.exports = router;
