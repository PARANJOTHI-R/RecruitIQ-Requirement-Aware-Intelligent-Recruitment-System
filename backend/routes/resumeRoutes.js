import express from 'express';
import multer from 'multer';
import path from 'path';
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

const upload = multer({ storage, fileFilter: pdfFilter });

const resumeRouter = express.Router();

resumeRouter.post('/', userAuth, upload.single('resume'), uploadResumeHandler);
resumeRouter.get('/', userAuth, getResumesHandler);
resumeRouter.get('/:id', userAuth, getResumeHandler);
resumeRouter.delete('/:id', userAuth, deleteResumeHandler);

export default resumeRouter;
