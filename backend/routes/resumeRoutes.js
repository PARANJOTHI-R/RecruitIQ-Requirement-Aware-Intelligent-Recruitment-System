import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import userAuth from '../middleWare/userAuth.js';
import {
    uploadResumeHandler,
    getResumesHandler,
    getResumeHandler,
    deleteResumeHandler
} from '../controllers/resumeController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store PDFs in backend/uploads/ with unique filenames
const storage = multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}-${file.originalname}`);
    }
});

const pdfFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are accepted'), false);
    }
};

const upload = multer({
    storage,
    fileFilter: pdfFilter,
    // Layer 1: reject oversized uploads during the multipart stream,
    // before the full file lands on disk (Issue 5).
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Layer 2: magic-byte check — verify the PDF signature (%PDF-) in the first 5 bytes.
// A file that passes the MIME/extension filter but isn't actually a PDF is rejected here.
const validatePdfSignature = (req, res, next) => {
    if (!req.file) return next(); // no file (caught by handler)

    let fd;
    try {
        const buf = Buffer.alloc(5);
        fd = fs.openSync(req.file.path, 'r');
        fs.readSync(fd, buf, 0, 5, 0);
        fs.closeSync(fd);
        fd = undefined;

        if (buf.toString('ascii', 0, 5) !== '%PDF-') {
            fs.unlinkSync(req.file.path); // remove the invalid file
            return res.status(400).json({ success: false, message: 'Invalid file: not a valid PDF (magic-byte check failed).' });
        }

        next();
    } catch (err) {
        if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(400).json({ success: false, message: 'Could not validate uploaded file.' });
    }
};

// Multer error handler: converts MulterError (file too large, wrong type) into clean JSON.
// Must be a 4-argument Express error middleware placed after the upload middleware.
const handleMulterError = (err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        // Clean up any partially-saved file
        if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
        return res.status(413).json({ success: false, message: 'File too large. Maximum allowed size is 10 MB.' });
    }
    if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Unexpected file field.' });
    }
    if (err) {
        return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
    }
    next();
};

const resumeRouter = express.Router();

resumeRouter.post('/', userAuth, upload.single('resume'), handleMulterError, validatePdfSignature, uploadResumeHandler);
resumeRouter.get('/', userAuth, getResumesHandler);
resumeRouter.get('/:id', userAuth, getResumeHandler);
resumeRouter.delete('/:id', userAuth, deleteResumeHandler);

export default resumeRouter;