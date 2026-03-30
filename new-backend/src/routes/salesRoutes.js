const express = require('express');
const router = express.Router();
const multer = require('multer');

const { authenticateToken } = require('../middleware/authMiddleware');

// ✅ Shared controller (keep this)
const salesController = require('../controllers/salesController');

// ✅ New split controllers
const salesAmazonController = require('../controllers/agents/sales-amazon/salesAmazonController');
const salesFlipkartController = require('../controllers/agents/sales-flipkart/salesFlipkartController');
const salesMyntraController = require('../controllers/agents/sales-myntra/salesMyntraController');
const salesBlinkitController = require('../controllers/agents/sales-blinkit/salesBlinkitController');
const salesFirstcryController = require('../controllers/agents/sales-firstcry/salesFirstcryController');

const upload = multer({ storage: multer.memoryStorage() });


// =====================================================
// ✅ SHARED ROUTES
// =====================================================
router.get(
    '/brands/:brandId/agents/:agentId/:agentType/files',
    authenticateToken,
    salesController.getWorkingFiles
);

router.get(
    '/brands/:brandId/agents/:agentId/:agentType/files/:fileId/download',
    authenticateToken,
    salesController.downloadWorkingFile
);

router.delete(
    '/brands/:brandId/agents/:agentId/:agentType/files/:fileId',
    authenticateToken,
    salesController.deleteWorkingFile
);


// =====================================================
// ✅ AMAZON ROUTES (FIXED)
// =====================================================
router.post(
    '/brands/:brandId/agents/:agentId/amazon/sku-master',
    authenticateToken,
    upload.single('file'),
    salesAmazonController.uploadSkuMaster
);

router.post(
    '/brands/:brandId/agents/:agentId/amazon/ledger-master',
    authenticateToken,
    upload.single('file'),
    salesAmazonController.uploadLedgerMaster
);

router.get(
    '/brands/:brandId/agents/:agentId/amazon/master-data',
    authenticateToken,
    salesAmazonController.getMasterData
);

router.post(
    '/brands/:brandId/agents/:agentId/amazon/generate',
    authenticateToken,
    upload.single('file'),
    salesAmazonController.generate
);


// =====================================================
// ✅ FLIPKART ROUTES (FIXED)
// =====================================================
router.post(
    '/brands/:brandId/agents/:agentId/flipkart/sku-master',
    authenticateToken,
    upload.single('file'),
    salesFlipkartController.uploadSkuMaster
);

router.post(
    '/brands/:brandId/agents/:agentId/flipkart/ledger-master',
    authenticateToken,
    upload.single('file'),
    salesFlipkartController.uploadLedgerMaster
);

router.get(
    '/brands/:brandId/agents/:agentId/flipkart/master-data',
    authenticateToken,
    salesFlipkartController.getMasterData
);

router.post(
    '/brands/:brandId/agents/:agentId/flipkart/generate',
    authenticateToken,
    upload.single('file'),
    salesFlipkartController.generate
);

// =====================================================
// ✅ MYNTRA ROUTES (NEW)
// =====================================================
router.post(
    '/brands/:brandId/agents/:agentId/myntra/sku-master',
    authenticateToken,
    upload.single('file'),
    salesMyntraController.uploadSkuMaster
);

router.post(
    '/brands/:brandId/agents/:agentId/myntra/ledger-master',
    authenticateToken,
    upload.single('file'),
    salesMyntraController.uploadLedgerMaster
);

router.get(
    '/brands/:brandId/agents/:agentId/myntra/master-data',
    authenticateToken,
    salesMyntraController.getMasterData
);

router.post(
    '/brands/:brandId/agents/:agentId/myntra/generate',
    authenticateToken,
    upload.fields([
        { name: 'rtoFile', maxCount: 1 },
        { name: 'packedFile', maxCount: 1 },
        { name: 'rtFile', maxCount: 1 },
        { name: 'file', maxCount: 1 }
    ]),
    salesMyntraController.generate
);

// =====================================================
// ✅ BLINKIT ROUTES (NEW)
// =====================================================
router.post(
    '/brands/:brandId/agents/:agentId/blinkit/sku-master',
    authenticateToken,
    upload.single('file'),
    salesBlinkitController.uploadSkuMaster
);

router.post(
    '/brands/:brandId/agents/:agentId/blinkit/ledger-master',
    authenticateToken,
    upload.single('file'),
    salesBlinkitController.uploadLedgerMaster
);

router.get(
    '/brands/:brandId/agents/:agentId/blinkit/master-data',
    authenticateToken,
    salesBlinkitController.getMasterData
);

router.post(
    '/brands/:brandId/agents/:agentId/blinkit/generate',
    authenticateToken,
    upload.single('file'),
    salesBlinkitController.generate
);

// =====================================================
// ✅ FIRSTCRY ROUTES (NEW)
// =====================================================
router.post(
    '/brands/:brandId/agents/:agentId/firstcry/sku-master',
    authenticateToken,
    upload.single('file'),
    salesFirstcryController.uploadSkuMaster
);

router.post(
    '/brands/:brandId/agents/:agentId/firstcry/ledger-master',
    authenticateToken,
    upload.single('file'),
    salesFirstcryController.uploadLedgerMaster
);

router.get(
    '/brands/:brandId/agents/:agentId/firstcry/master-data',
    authenticateToken,
    salesFirstcryController.getMasterData
);

router.post(
    '/brands/:brandId/agents/:agentId/firstcry/generate',
    authenticateToken,
    upload.single('file'),
    salesFirstcryController.generate
);

module.exports = router;