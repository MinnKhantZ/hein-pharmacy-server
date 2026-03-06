const express = require('express');
const InvoiceController = require('../controllers/invoiceController');
const { authenticateToken } = require('../middleware/auth');
const { validateInvoice, validateInvoiceSignedUrlRequest } = require('../middleware/validation');

const router = express.Router();

// --- Public proxy download (no auth, keys are unguessable UUIDs) ---
router.get('/image/*', InvoiceController.proxyGetImage);

// Server proxy upload — auth via HMAC upload token, no JWT required
router.put(
  '/upload',
  express.raw({ type: ['image/*', 'application/octet-stream'], limit: '50mb' }),
  InvoiceController.proxyUploadImage
);

router.use(authenticateToken);

router.get('/', InvoiceController.getInvoices);
router.post('/upload-signed-url', validateInvoiceSignedUrlRequest, InvoiceController.getInvoiceUploadSignedUrl);
router.get('/:id', InvoiceController.getInvoice);
router.post('/', validateInvoice, InvoiceController.createInvoice);
router.put('/:id', validateInvoice, InvoiceController.updateInvoice);
router.delete('/:id', InvoiceController.deleteInvoice);

module.exports = router;
