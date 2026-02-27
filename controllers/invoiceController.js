const pool = require('../config/database');
const { createInvoiceUploadSignedUrl } = require('../services/r2Service');

class InvoiceController {
  static ensureAdmin(req, res) {
    if (req.user.username !== 'admin') {
      res.status(403).json({ error: 'Access denied' });
      return false;
    }

    return true;
  }

  static async createInvoice(req, res) {
    try {
      console.log('createInvoice invoked, user:', req.user && req.user.id, 'body:', req.body);
      if (!InvoiceController.ensureAdmin(req, res)) {
        console.log('createInvoice aborted: non-admin user', req.user && req.user.username);
        return;
      }

      const { invoice_id, company_name, payment_method, invoice_date, image_url } = req.body;

      console.log('createInvoice params:', {
        invoice_id,
        company_name,
        payment_method,
        invoice_date,
        image_url,
        created_by: req.user.id
      });

      const insertResult = await pool.query(
        `INSERT INTO invoices
          (invoice_id, company_name, payment_method, invoice_date, image_url, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [invoice_id, company_name, payment_method, invoice_date, image_url, req.user.id]
      );

      console.log('createInvoice succeeded, inserted row:', insertResult.rows[0]);
      return res.status(201).json({
        message: 'Invoice record created successfully',
        invoice: insertResult.rows[0]
      });
    } catch (error) {
      console.error('Create invoice error:', error, 'body:', req.body);

      if (error.code === '23505') {
        console.log('Duplicate invoice_id detected:', req.body.invoice_id);
        return res.status(400).json({ error: 'Invoice ID already exists' });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getInvoiceUploadSignedUrl(req, res) {
    try {
      console.log('getInvoiceUploadSignedUrl called by', req.user && req.user.id, 'body', req.body);
      if (!InvoiceController.ensureAdmin(req, res)) {
        console.log('getInvoiceUploadSignedUrl aborted for non-admin user', req.user && req.user.username);
        return;
      }

      const { filename, content_type } = req.body;
      console.log('getInvoiceUploadSignedUrl params:', { filename, content_type });

      const { signedUrl, imageUrl, key, uploadToken, useWorkerProxy, multipart } = await createInvoiceUploadSignedUrl({
        filename,
        contentType: content_type
      });

      console.log('getInvoiceUploadSignedUrl succeeded, returning key:', key, 'imageUrl:', imageUrl);
      return res.json({
        signedUrl,
        imageUrl,
        key,
        method: 'PUT',
        contentType: content_type,
        uploadToken,
        useWorkerProxy,
        multipart
      });
    } catch (error) {
      console.error('Get invoice upload signed URL error:', error, 'body:', req.body);

      if (error.message && error.message.includes('Missing R2 configuration')) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getInvoices(req, res) {
    try {
      if (!InvoiceController.ensureAdmin(req, res)) {
        return;
      }

      const {
        page = 1,
        limit = 20,
        search,
        payment_method,
        start_date,
        end_date,
        sortBy = 'invoice_date',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const whereConditions = [];
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount += 1;
        whereConditions.push(`(invoice_id ILIKE $${paramCount} OR company_name ILIKE $${paramCount})`);
        params.push(`%${search}%`);
      }

      if (payment_method) {
        paramCount += 1;
        whereConditions.push(`payment_method = $${paramCount}`);
        params.push(payment_method);
      }

      if (start_date) {
        paramCount += 1;
        whereConditions.push(`invoice_date >= $${paramCount}`);
        params.push(start_date);
      }

      if (end_date) {
        paramCount += 1;
        whereConditions.push(`invoice_date <= $${paramCount}`);
        params.push(end_date);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const validSortFields = ['invoice_date', 'created_at', 'invoice_id', 'company_name'];
      const validSortOrders = ['ASC', 'DESC'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'invoice_date';
      const direction = validSortOrders.includes(String(sortOrder).toUpperCase())
        ? String(sortOrder).toUpperCase()
        : 'DESC';

      const dataQuery = `
        SELECT id, invoice_id, company_name, payment_method, invoice_date, image_url, created_by, created_at, updated_at
        FROM invoices
        ${whereClause}
        ORDER BY ${sortField} ${direction}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      const countQuery = `
        SELECT COUNT(*) AS total
        FROM invoices
        ${whereClause}
      `;

      const [dataResult, countResult] = await Promise.all([
        pool.query(dataQuery, [...params, parseInt(limit, 10), offset]),
        pool.query(countQuery, params)
      ]);

      const total = Number(countResult.rows[0].total || 0);

      return res.json({
        invoices: dataResult.rows,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / parseInt(limit, 10))
        }
      });
    } catch (error) {
      console.error('Get invoices error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getInvoice(req, res) {
    try {
      if (!InvoiceController.ensureAdmin(req, res)) {
        return;
      }

      const { id } = req.params;

      const result = await pool.query(
        `SELECT id, invoice_id, company_name, payment_method, invoice_date, image_url, created_by, created_at, updated_at
         FROM invoices
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Get invoice error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateInvoice(req, res) {
    try {
      if (!InvoiceController.ensureAdmin(req, res)) {
        return;
      }

      const { id } = req.params;
      const { invoice_id, company_name, payment_method, invoice_date, image_url } = req.body;

      const result = await pool.query(
        `UPDATE invoices
         SET invoice_id=$1, company_name=$2, payment_method=$3, invoice_date=$4, image_url=$5, updated_at=NOW()
         WHERE id=$6
         RETURNING *`,
        [invoice_id, company_name, payment_method, invoice_date, image_url, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      return res.json({ message: 'Invoice updated successfully', invoice: result.rows[0] });
    } catch (error) {
      console.error('Update invoice error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Invoice ID already exists' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteInvoice(req, res) {
    try {
      if (!InvoiceController.ensureAdmin(req, res)) {
        return;
      }

      const { id } = req.params;
      // Get image_url before deleting
      const selectResult = await pool.query(
        'SELECT image_url FROM invoices WHERE id=$1',
        [id]
      );
      if (selectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      const imageUrl = selectResult.rows[0].image_url;

      // Delete image from bucket
      const { deleteInvoiceImageByUrl } = require('../services/r2Service');
      await deleteInvoiceImageByUrl(imageUrl);

      // Delete invoice record
      const result = await pool.query(
        'DELETE FROM invoices WHERE id=$1 RETURNING id',
        [id]
      );

      return res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      console.error('Delete invoice error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = InvoiceController;
