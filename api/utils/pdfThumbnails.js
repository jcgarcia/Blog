/**
 * PDF Thumbnail Generation Utility
 * 
 * This module handles the generation of thumbnails for PDF files using direct poppler-utils calls.
 * It provides functions to generate, save, and manage PDF thumbnails.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

/**
 * Configuration for PDF thumbnail generation
 */
const THUMBNAIL_CONFIG = {
  resolution: 150, // DPI for thumbnail resolution
  format: 'png', // Output format (png or jpeg)
  quality: 80, // JPEG quality (0-100) - only used for JPEG
  scaleToWidth: 300, // Target width in pixels
  singlePage: true, // Only generate thumbnail for first page
};

/**
 * Generate a thumbnail for a PDF file using poppler-utils
 * @param {string} pdfPath - Full path to the PDF file
 * @param {string} outputDir - Directory to save the thumbnail
 * @param {string} filename - Base filename (without extension) for the thumbnail
 * @returns {Promise<{success: boolean, thumbnailPath?: string, error?: string}>}
 */
export async function generatePdfThumbnail(pdfPath, outputDir, filename) {
  try {
    // Validate input parameters
    if (!pdfPath || !outputDir || !filename) {
      throw new Error('Missing required parameters: pdfPath, outputDir, or filename');
    }

    // Check if PDF file exists
    if (!existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    console.log(`🖼️  Generating PDF thumbnail for: ${path.basename(pdfPath)}`);
    console.log(`📁 Output directory: ${outputDir}`);

    // Generate thumbnail using pdftoppm
    const outputPrefix = path.join(outputDir, `${filename}-thumb`);
    const thumbnailPath = `${outputPrefix}.png`;
    
    // Build pdftoppm command
    // -f 1 -l 1: only first page
    // -singlefile: don't add page numbers to filename
    // -scale-to-x: scale to specific width
    // -png: output PNG format
    const command = [
      'pdftoppm',
      '-f 1', // first page
      '-l 1', // last page (only first page)
      '-singlefile', // single file output
      `-scale-to-x ${THUMBNAIL_CONFIG.scaleToWidth}`, // scale to width
      '-png', // PNG format
      `"${pdfPath}"`, // input PDF (quoted for spaces)
      `"${outputPrefix}"` // output prefix (quoted for spaces)
    ].join(' ');

    console.log(`🔧 Running command: ${command}`);

    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('Warning')) {
      console.warn('⚠️ pdftoppm stderr:', stderr);
    }

    // Verify the thumbnail was created
    if (!existsSync(thumbnailPath)) {
      throw new Error(`Thumbnail file was not created: ${thumbnailPath}`);
    }

    // Get file stats for verification
    const stats = await fs.stat(thumbnailPath);
    console.log(`✅ Thumbnail generated successfully: ${path.basename(thumbnailPath)} (${stats.size} bytes)`);

    return {
      success: true,
      thumbnailPath: thumbnailPath,
      thumbnailFilename: path.basename(thumbnailPath),
      size: stats.size
    };

  } catch (error) {
    console.error(`❌ Failed to generate PDF thumbnail for ${pdfPath}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up thumbnail files when a PDF is deleted
 * @param {string} thumbnailPath - Path to the thumbnail file to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deletePdfThumbnail(thumbnailPath) {
  try {
    if (!thumbnailPath) {
      return { success: true }; // No thumbnail to delete
    }

    if (existsSync(thumbnailPath)) {
      await fs.unlink(thumbnailPath);
      console.log(`🗑️  Deleted PDF thumbnail: ${thumbnailPath}`);
    }

    return { success: true };

  } catch (error) {
    console.error(`❌ Failed to delete PDF thumbnail ${thumbnailPath}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get relative path for thumbnail storage
 * @param {string} originalPath - Original file path
 * @param {string} filename - Base filename
 * @returns {string} Relative path for thumbnail
 */
export function getThumbnailRelativePath(originalPath, filename) {
  const directory = path.dirname(originalPath);
  const thumbnailFilename = `${filename}-thumb.png`;
  return path.join(directory, 'thumbnails', thumbnailFilename);
}

/**
 * Generate thumbnail for existing PDF files (batch operation)
 * @param {Array} pdfFiles - Array of PDF file objects with paths
 * @param {string} baseOutputDir - Base directory for thumbnails
 * @returns {Promise<{processed: number, successful: number, failed: number, errors: Array}>}
 */
export async function generateThumbnailsForExistingPdfs(pdfFiles, baseOutputDir) {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (const pdfFile of pdfFiles) {
    results.processed++;
    
    try {
      const outputDir = path.join(baseOutputDir, 'thumbnails');
      const filenameWithoutExt = path.parse(pdfFile.filename).name;
      
      const result = await generatePdfThumbnail(
        pdfFile.fullPath,
        outputDir,
        filenameWithoutExt
      );

      if (result.success) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push({
          file: pdfFile.filename,
          error: result.error
        });
      }

    } catch (error) {
      results.failed++;
      results.errors.push({
        file: pdfFile.filename,
        error: error.message
      });
    }
  }

  console.log(`📊 PDF Thumbnail Generation Summary:
  Processed: ${results.processed}
  Successful: ${results.successful}
  Failed: ${results.failed}`);

  return results;
}

export default {
  generatePdfThumbnail,
  deletePdfThumbnail,
  getThumbnailRelativePath,
  generateThumbnailsForExistingPdfs,
  THUMBNAIL_CONFIG
};
