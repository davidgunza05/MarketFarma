const PDFDocument = require('pdfkit');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const generatePDF = async (data, templatePath, outputPath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);
    
    ejs.renderFile(templatePath, data, (err, html) => {
      if (err) {
        reject(err);
      } else {
        // Convert HTML to PDF content
        doc.font('Helvetica').fontSize(12).text(html, { width: 410 });
        doc.end();
        stream.on('finish', () => {
          resolve(outputPath);
        });
      }
    });
  });
};

module.exports = generatePDF;
