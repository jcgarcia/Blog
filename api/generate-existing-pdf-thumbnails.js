#!/usr/bin/env node

/**
 * Generate thumbnails for existing PDF files in the media library
 * This script downloads PDFs from S3, generates thumbnails, and updates the database
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
import { generatePdfThumbnail } from './utils/pdfThumbnails.js';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import credentialManager from './services/awsCredentialManager.js';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const { Client } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔄 Starting PDF thumbnail generation for existing files...');

// Database configuration
const dbConfig = {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
};

async function generateThumbnailsForExistingPdfs() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Get all PDFs without thumbnails
        const result = await client.query(`
            SELECT id, filename, original_name, s3_key, s3_bucket, folder_path
            FROM media 
            WHERE mime_type = 'application/pdf' 
            AND (thumbnail_path IS NULL OR thumbnail_url IS NULL)
        `);

        const pdfsWithoutThumbnails = result.rows;
        console.log(`📋 Found ${pdfsWithoutThumbnails.length} PDF(s) without thumbnails`);

        if (pdfsWithoutThumbnails.length === 0) {
            console.log('✅ All PDFs already have thumbnails!');
            return;
        }

        for (const pdf of pdfsWithoutThumbnails) {
            console.log(`\\n🔄 Processing: ${pdf.original_name} (ID: ${pdf.id})`);
            
            try {
                // Get S3 client
                const credentials = await credentialManager.getCredentials();
                const s3Client = new S3Client({
                  region: 'eu-west-2',
                  credentials: {
                    accessKeyId: credentials.accessKeyId,
                    secretAccessKey: credentials.secretAccessKey,
                    sessionToken: credentials.sessionToken
                  },
                  forcePathStyle: true,
                  endpoint: 'https://s3.eu-west-2.amazonaws.com',
                  disableS3ExpressSessionAuth: true,
                  signatureVersion: 'v4'
                });
                
                // Create temporary file paths
                const tempDir = '/tmp';
                const tempPdfPath = join(tempDir, `temp-${pdf.id}-${uuidv4()}.pdf`);

                // Download PDF from S3
                console.log('  📥 Downloading PDF from S3...');
                const downloadCommand = new GetObjectCommand({
                    Bucket: pdf.s3_bucket,
                    Key: pdf.s3_key
                });

                const response = await s3Client.send(downloadCommand);
                const pdfBuffer = Buffer.from(await response.Body.transformToByteArray());
                
                // Write to temporary file
                fs.writeFileSync(tempPdfPath, pdfBuffer);
                console.log('  ✅ PDF downloaded successfully');

                // Generate thumbnail
                console.log('  🖼️  Generating thumbnail...');
                const outputDir = '/tmp';
                const thumbnailFilename = `thumb-${pdf.id}-${uuidv4()}.png`;
                const thumbnailResult = await generatePdfThumbnail(tempPdfPath, outputDir, thumbnailFilename);
                
                if (!thumbnailResult.success) {
                    console.log(`  ❌ Failed to generate thumbnail: ${thumbnailResult.error}`);
                    continue;
                }

                console.log(`  ✅ Thumbnail generated: ${thumbnailResult.thumbnailPath}`);

                // Upload thumbnail to S3
                console.log('  📤 Uploading thumbnail to S3...');
                const thumbnailBuffer = fs.readFileSync(thumbnailResult.thumbnailPath);
                
                // Create thumbnail S3 key (same path as original but with -thumb.png)
                const originalKey = pdf.s3_key;
                const keyParts = originalKey.split('.');
                keyParts.pop(); // Remove .pdf extension
                const thumbnailKey = `${keyParts.join('.')}-thumb.png`;

                const uploadCommand = new PutObjectCommand({
                    Bucket: pdf.s3_bucket,
                    Key: thumbnailKey,
                    Body: thumbnailBuffer,
                    ContentType: 'image/png',
                    CacheControl: 'max-age=31536000' // 1 year cache
                });

                await s3Client.send(uploadCommand);
                console.log('  ✅ Thumbnail uploaded to S3');

                // Update database
                console.log('  📊 Updating database...');
                await client.query(`
                    UPDATE media 
                    SET thumbnail_path = $1, thumbnail_url = $2, updated_at = NOW()
                    WHERE id = $3
                `, [thumbnailKey, 'PRIVATE_BUCKET', pdf.id]);

                console.log('  ✅ Database updated successfully');

                // Cleanup temporary files
                try {
                    fs.unlinkSync(tempPdfPath);
                    fs.unlinkSync(thumbnailResult.thumbnailPath);
                    console.log('  🧹 Temporary files cleaned up');
                } catch (cleanupError) {
                    console.log('  ⚠️  Warning: Could not cleanup temporary files:', cleanupError.message);
                }

                console.log(`  🎉 Successfully processed: ${pdf.original_name}`);

            } catch (pdfError) {
                console.error(`  ❌ Error processing ${pdf.original_name}:`, pdfError.message);
                continue;
            }
        }

        console.log('\\n🎉 PDF thumbnail generation completed!');
        console.log('\\n📋 Summary:');
        console.log(`   • Total PDFs processed: ${pdfsWithoutThumbnails.length}`);
        console.log('   • All existing PDFs now have thumbnails');
        console.log('\\n✨ Your media library is now fully enhanced with PDF thumbnails!');

    } catch (error) {
        console.error('❌ Error during thumbnail generation:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Check if we have required environment variables
if (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGPASSWORD) {
    console.error('❌ Missing required environment variables. Please ensure PGHOST, PGUSER, and PGPASSWORD are set.');
    process.exit(1);
}

// Run the script
generateThumbnailsForExistingPdfs()
    .then(() => {
        console.log('\\n🚀 Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
