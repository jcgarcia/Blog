/**
 * Test script for PDF thumbnail generation
 * This script tests the PDF thumbnail utility functions
 */

import { generatePdfThumbnail } from './utils/pdfThumbnails.js';
import path from 'path';
import fs from 'fs';

async function testPdfThumbnails() {
  console.log('🧪 Testing PDF thumbnail generation...');
  
  // Check if we have any existing PDF files to test with
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('❌ No uploads directory found, creating test structure...');
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Check if poppler-utils is available
  try {
    const { exec } = await import('child_process');
    exec('pdftoppm -h', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ poppler-utils not available:', error.message);
        return;
      }
      console.log('✅ poppler-utils is available');
    });
  } catch (error) {
    console.log('❌ Error checking poppler-utils:', error.message);
  }
  
  // Test with a sample PDF (create a minimal one for testing)
  console.log('📄 Creating test PDF...');
  
  try {
    // Create a simple test PDF content (just text)
    const testPdfContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF for thumbnail) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
292
%%EOF`);
    
    const testPdfPath = path.join(uploadsDir, 'test-document.pdf');
    const thumbnailDir = path.join(uploadsDir, 'test-thumbnails');
    
    fs.writeFileSync(testPdfPath, testPdfContent);
    console.log(`✅ Test PDF created: ${testPdfPath}`);
    
    // Test thumbnail generation
    console.log('🖼️  Testing thumbnail generation...');
    const result = await generatePdfThumbnail(testPdfPath, thumbnailDir, 'test-document');
    
    if (result.success) {
      console.log(`✅ Thumbnail generation successful!`);
      console.log(`   Thumbnail path: ${result.thumbnailPath}`);
      console.log(`   Thumbnail filename: ${result.thumbnailFilename}`);
      console.log(`   File size: ${result.size} bytes`);
    } else {
      console.log(`❌ Thumbnail generation failed: ${result.error}`);
    }
    
    // Clean up test files
    try {
      fs.unlinkSync(testPdfPath);
      if (result.success && fs.existsSync(result.thumbnailPath)) {
        fs.unlinkSync(result.thumbnailPath);
      }
      if (fs.existsSync(thumbnailDir)) {
        fs.rmdirSync(thumbnailDir, { recursive: true });
      }
      console.log('🧹 Test files cleaned up');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testPdfThumbnails().then(() => {
  console.log('🏁 PDF thumbnail test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script error:', error);
  process.exit(1);
});
