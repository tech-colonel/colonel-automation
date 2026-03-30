const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.get('/users', authenticateToken, authorize('admin'), userController.getAllUsers);
router.post('/users', authenticateToken, authorize('admin'), userController.createUser);
router.put('/users/:id', authenticateToken, authorize('admin'), userController.updateUser);
router.delete('/users/:id', authenticateToken, authorize('admin'), userController.deleteUser);

module.exports = router;
