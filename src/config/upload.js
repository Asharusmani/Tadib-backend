// config/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Uploads directory created:', uploadsDir);
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('📂 Multer destination called');
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    console.log('\n🔍 === MULTER FILENAME GENERATION ===');
    console.log('📋 req.userId:', req.userId);
    console.log('📋 req.user:', req.user);
    console.log('📋 file.originalname:', file.originalname);
    console.log('📋 file.mimetype:', file.mimetype);
    
    // ✅ CRITICAL FIX: Ensure userId exists
    let userId = req.userId || req.user?.userId || req.user?._id;
    
    // Convert ObjectId to string if needed
    if (userId && typeof userId === 'object' && userId.toString) {
      userId = userId.toString();
    }
    
    // Fallback to 'user' if still undefined
    if (!userId) {
      console.error('❌ CRITICAL: No userId available in request!');
      console.error('📋 req keys:', Object.keys(req));
      userId = 'user-' + Date.now();
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    
    const filename = `avatar-${userId}-${uniqueSuffix}${ext}`;
    
    console.log('✅ Generated filename:', filename);
    console.log('=== MULTER FILENAME GENERATION END ===\n');
    
    cb(null, filename);
  }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
  console.log('🔍 File filter check:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
  });

  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp', 
    'image/heic',
    'image/heif'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log('✅ File type accepted');
    cb(null, true);
  } else {
    console.log('❌ File type rejected:', file.mimetype);
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, GIF, HEIC and WebP are allowed.`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

// Helper function to delete file
const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('Delete file error:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Helper function to get file URL
const getFileUrl = (filename, req) => {
  const protocol = req.protocol;
  const host = req.get('host');
  const url = `${protocol}://${host}/uploads/avatars/${filename}`;
  
  console.log('🔗 Generated file URL:', {
    filename: filename,
    url: url
  });
  
  return url;
};

module.exports = {
  upload,
  deleteFile,
  getFileUrl,
  uploadsDir
};