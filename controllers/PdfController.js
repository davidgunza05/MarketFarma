const Farmacia = require('../models/farmacia/farmacia');
const ProdutoModel = require('../models/admin/product');
const ClienteModel = require("../models/user/details")
const OrderModel = require("../models/user/orders")
const CategoriaModel = require("../models/admin/category");
const { Auth } = require('../config/auth');
const upload = require("../utilities/imageUpload"); 
const DesconontoModel = require("../models/admin/coupons");
const cron = require('node-cron')
const { default: mongoose } = require("mongoose");
const sharp = require("sharp");
const bcrypt = require('bcryptjs');  
const passport = require('passport');
const moment = require("moment");  
const PDFDocument = require('pdfkit');
const fs = require('fs'); 
const pdf = require('html-pdf');
const path = require('path');
const logoPath = path.join(__dirname, '../public/img/timeless-logo.png');
const logoData = fs.readFileSync(logoPath, { encoding: 'base64' });
const logoDataURI = `data:image/png;base64,${logoData}`;
 
exports.Total =  async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
  
      const orderData = await OrderModel.aggregate([
        { $match: { farmacia: req.user._id } },
        {
          $project: {
            totalProducts: "$totalQuantity",
            billAmount: "$finalPrice",
            month: { $month: "$orderedOn" },
            year: { $year: "$orderedOn" },
          },
        },
        {
          $group: {
            _id: { month: "$month", year: "$year" },
            totalProducts: { $sum: "$totalProducts" },
            totalOrders: { $sum: 1 },
            revenue: { $sum: "$billAmount" },
            avgBillPerOrder: { $avg: "$billAmount" },
          },
        },
        { $match: { "_id.year": currentYear } },
        { $sort: { "_id.month": 1 } },
      ]);
  
      const dailyOrderData = await OrderModel.aggregate([
        { $match: { farmacia: req.user._id } },
        {
          $project: {
            totalProducts: "$totalQuantity",
            billAmount: "$finalPrice",
            month: { $month: "$orderedOn" },
            year: { $year: "$orderedOn" },
            day: { $dayOfMonth: "$orderedOn" },
          },
        },
        {
          $group: {
            _id: { month: "$month", year: "$year", day: "$day" },
            totalProducts: { $sum: "$totalProducts" },
            totalOrders: { $sum: 1 },
            revenue: { $sum: "$billAmount" },
            avgBillPerOrder: { $avg: "$billAmount" },
          },
        },
        { $match: { "_id.year": currentYear } },
        { $sort: { "_id.month": 1, "_id.day": 1 } },
      ]);
  
      const deliveredOrders = await OrderModel.countDocuments({ farmacia: req.user._id, delivered: true });
  
      const notDelivered = await OrderModel.aggregate([
        { $match: { farmacia: req.user._id, delivered: false } },
        {
          $group: {
            _id: "$status",
            status: { $sum: 1 },
          },
        },
      ]);
  
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const day = date.getDate();
      const month = date.getMonth(); // Note que getMonth() retorna 0-11
      const year = date.getFullYear();
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const monthName = months[month];
      const formattedDate = `${day.toString().padStart(2, '0')} de ${monthName} de ${year}`;
  
      const htmlContent = `
      
      <!DOCTYPE html>
  <html lang="en, id">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
  * {
    margin: 0 auto;
    padding: 0 auto;
    user-select: none;
  }
  
  body { 
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased; 
    font-size: 16px;
  }
  
  .wrapper-invoice {
    display: flex;
    justify-content: center;
  }
  .wrapper-invoice .invoice {
    height: auto;
    background: #fff;
    margin-top: 6vh; 
    padding: 3rem; 
    width: 100%;
    box-sizing: border-box; 
  }
  .wrapper-invoice .invoice .invoice-information {
    float: right;
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-information b {
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-information p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-logo-brand h2 {
    text-transform: uppercase;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    font-size: 2.9vh;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-logo-brand img {
    max-width: 220px;
    width: 100%;
    object-fit: fill;
  }
  .wrapper-invoice .invoice .invoice-head {
    display: flex;
    margin-top: 8vh;
  }
  .wrapper-invoice .invoice .invoice-head .head {
    width: 100%;
    box-sizing: border-box;
  }
  .wrapper-invoice .invoice .invoice-head .client-info {
    text-align: left;
  }
  .wrapper-invoice .invoice .invoice-head .client-info h2 {
    font-weight: 500;
    letter-spacing: 0.3px;
    font-size: 16px;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-head .client-info p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-head .client-data {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-head .client-data h2 {
    font-weight: 500;
    letter-spacing: 0.3px;
    font-size: 16px;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-head .client-data p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-body {
    margin-top: 8vh;
  }
  .wrapper-invoice .invoice .invoice-body .table {
    border-collapse: collapse;
    width: 100%;
  }
  .wrapper-invoice .invoice .invoice-body .table thead tr th {
    font-size: 16px;
    border: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #eeeeee;
  }
  .wrapper-invoice .invoice .invoice-body .table tbody tr td {
    font-size: 16px;
    border: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #fff;
  }
  .wrapper-invoice .invoice .invoice-body .table tbody tr td:nth-child(2) {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table {
    display: flex;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column {
    width: 100%;
    box-sizing: border-box;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal {
    border-collapse: collapse;
    box-sizing: border-box;
    width: 100%;
    margin-top: 16px;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal tbody tr td {
    font-size: 16px;
    border-bottom: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #fff;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal tbody tr td:nth-child(2) {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-body .invoice-total-amount {
    margin-top: 1rem;
  }
  .wrapper-invoice .invoice .invoice-body .invoice-total-amount p {
    font-weight: bold;
    color: "#0F172A";
    text-align: right;
    font-size: 16px;
  }
  .wrapper-invoice .invoice .invoice-footer {
    margin-top: 4vh;
  }
  .wrapper-invoice .invoice .invoice-footer p {
    font-size: 1.7vh;
    color: gray;
  }
  
  .copyright {
    margin-top: 2rem;
    text-align: center;
  }
  .copyright p {
    color: gray;
    font-size: 1.8vh;
  }
  
  @media print {
    .table thead tr th {
      -webkit-print-color-adjust: exact;
      background-color: #eeeeee !important;
    }
  
    .copyright {
      display: none;
    }
  }
  .rtl {
    direction: rtl;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }
  .rtl .invoice-information {
    float: left !important;
    text-align: left !important;
  }
  .rtl .invoice-head .client-info {
    text-align: right !important;
  }
  .rtl .invoice-head .client-data {
    text-align: left !important;
  }
  .rtl .invoice-body .table thead tr th {
    text-align: right !important;
  }
  .rtl .invoice-body .table tbody tr td {
    text-align: right !important;
  }
  .rtl .invoice-body .table tbody tr td:nth-child(2) {
    text-align: left !important;
  }
  .rtl .invoice-body .flex-table .flex-column .table-subtotal tbody tr td {
    text-align: right !important;
  }
  .rtl .invoice-body .flex-table .flex-column .table-subtotal tbody tr td:nth-child(2) {
    text-align: left !important;
  }
  .rtl .invoice-body .invoice-total-amount p {
    text-align: left !important;
  }
  td {
      text-align: center;  /* Centraliza o texto */
      justify-content: center; /* Centraliza o conteúdo */
  }
   
  </style>
    </head>
    <body>
      <section class="wrapper-invoice">
        <!-- switch mode rtl by adding class rtl on invoice class -->
        <div class="invoice">
          <div class="invoice-information">  
          <p><b>Data: </b> ${formattedDate}</p>
          </div>
          <!-- logo brand invoice -->
          <div class="invoice-logo-brand">
            <!-- <h2>Tampsh.</h2> -->
          <img src="${logoDataURI}" alt="Logo" />
          </div>
          <!-- invoice head -->
          <div class="invoice-head">
            <div class="head client-info">
              <p>Projeto da PAP.</p>
              <p>Gerado por: <strong>${req.user.name}</strong></p> 
            </div> 
          </div>
   
          <!-- invoice body-->
          <div class="invoice-body">
              <h3>1. Venda por mês</h3>
              <br>
            <table class="table">
              <thead>
                <tr> 
                  <th>Mês</th>
                  <th>Produtos vendidos</th>
                  <th>Total de pedidos</th>
                  <th>Receita</th>
                  <th>Gasto médio por pedido</th> 
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: center;">${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][orderData[0]._id.month - 1]} de ${orderData[0]._id.year}</td>
                  <td style="text-align: center;">${orderData[0].totalProducts}</td>
                  <td style="text-align: center;">${orderData[0].totalOrders}</td>
                  <td style="text-align: center;">${orderData[0].revenue} Kz</td>
                  <td style="text-align: center;">${orderData[0].avgBillPerOrder} Kz</td> 
                </tr> 
              </tbody>
            </table>
          </div>
  
          <div class="invoice-body">
              <h3>1. Venda por dia</h3>
              <br>
            <table class="table">
              <thead>
                <tr> 
                  <th>Data</th>
                  <th>Produtos vendidos</th>
                  <th>Total de pedidos</th>
                  <th>Receita</th>
                  <th>Gasto médio por pedido</th> 
                </tr>
              </thead>
              <tbody>
                  ${dailyOrderData.map(dailyOrder => `
                      <tr> 
                          <td style="text-align: center;">${String(dailyOrder._id.day).padStart(2, '0')} de ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][dailyOrder._id.month - 1]} de ${dailyOrder._id.year}</td>
                          <td style="text-align: center;">${dailyOrder.totalOrders}</td>
                          <td style="text-align: center;">${dailyOrder.totalProducts}</td>
                          <td style="text-align: center;">${dailyOrder.revenue} Kz</td>
                          <td style="text-align: center;">${dailyOrder.avgBillPerOrder} Kz</td>
                      </tr>   
                  `).join('')}
              </tbody>
            </table>
          </div> 
        </div>
      </section> 
    </body>
  </html>
      `;
  
      const options = { format: 'Letter' };
  
      pdf.create(htmlContent, options).toFile('./example.pdf', (err, resFile) => {
        if (err) {
          console.error('Erro ao criar o PDF:', err);
          return res.status(500).send('Erro ao processar a solicitação');
        }
        
        res.setHeader('Content-Disposition', 'attachment; filename="fatura.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
  
        const filestream = fs.createReadStream('./example.pdf');
        filestream.pipe(res);
  
        filestream.on('close', () => {
          fs.unlink('./example.pdf', (err) => {
            if (err) {
              console.error('Erro ao excluir o arquivo PDF:', err);
            }
          });
        });
      });
    } catch (error) {
      console.error("Erro ao criar dados do PDF:", error);
      res.status(500).send('Erro no servidor');
    }
}
   
exports.Status =  async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const deliveredOrders = await OrderModel.countDocuments({ farmacia: req.user._id, delivered: true });
      const notDelivered = await OrderModel.aggregate([
        { $match: { farmacia: req.user._id, delivered: false } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);
      let inTransit = 0;
      let Cancelado = 0;
      notDelivered.forEach(order => {
        if (order._id === "Processando") {
          inTransit = order.count;
        } else if (order._id === "Cancelado") {
          Cancelado = order.count;
        }
      });
  
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const day = date.getDate();
      const month = date.getMonth(); // Note que getMonth() retorna 0-11
      const year = date.getFullYear();
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const monthName = months[month];
      const formattedDate = `${day.toString().padStart(2, '0')} de ${monthName} de ${year}`;
  
  
      const htmlContent = `
      
      <!DOCTYPE html>
  <html lang="en, id">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
  * {
    margin: 0 auto;
    padding: 0 auto;
    user-select: none;
  }
  
  body { 
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased; 
    font-size: 16px;
  }
  
  .wrapper-invoice {
    display: flex;
    justify-content: center;
  }
  .wrapper-invoice .invoice {
    height: auto;
    background: #fff;
    margin-top: 6vh; 
    padding: 3rem; 
    width: 100%;
    box-sizing: border-box; 
  }
  .wrapper-invoice .invoice .invoice-information {
    float: right;
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-information b {
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-information p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-logo-brand h2 {
    text-transform: uppercase;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    font-size: 2.9vh;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-logo-brand img {
    max-width: 220px;
    width: 100%;
    object-fit: fill;
  }
  .wrapper-invoice .invoice .invoice-head {
    display: flex;
    margin-top: 8vh;
  }
  .wrapper-invoice .invoice .invoice-head .head {
    width: 100%;
    box-sizing: border-box;
  }
  .wrapper-invoice .invoice .invoice-head .client-info {
    text-align: left;
  }
  .wrapper-invoice .invoice .invoice-head .client-info h2 {
    font-weight: 500;
    letter-spacing: 0.3px;
    font-size: 16px;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-head .client-info p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-head .client-data {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-head .client-data h2 {
    font-weight: 500;
    letter-spacing: 0.3px;
    font-size: 16px;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-head .client-data p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-body {
    margin-top: 8vh;
  }
  .wrapper-invoice .invoice .invoice-body .table {
    border-collapse: collapse;
    width: 100%;
  }
  .wrapper-invoice .invoice .invoice-body .table thead tr th {
    font-size: 16px;
    border: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #eeeeee;
  }
  .wrapper-invoice .invoice .invoice-body .table tbody tr td {
    font-size: 16px;
    border: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #fff;
  }
  .wrapper-invoice .invoice .invoice-body .table tbody tr td:nth-child(2) {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table {
    display: flex;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column {
    width: 100%;
    box-sizing: border-box;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal {
    border-collapse: collapse;
    box-sizing: border-box;
    width: 100%;
    margin-top: 16px;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal tbody tr td {
    font-size: 16px;
    border-bottom: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #fff;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal tbody tr td:nth-child(2) {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-body .invoice-total-amount {
    margin-top: 1rem;
  }
  .wrapper-invoice .invoice .invoice-body .invoice-total-amount p {
    font-weight: bold;
    color: "#0F172A";
    text-align: right;
    font-size: 16px;
  }
  .wrapper-invoice .invoice .invoice-footer {
    margin-top: 4vh;
  }
  .wrapper-invoice .invoice .invoice-footer p {
    font-size: 1.7vh;
    color: gray;
  }
  
  .copyright {
    margin-top: 2rem;
    text-align: center;
  }
  .copyright p {
    color: gray;
    font-size: 1.8vh;
  }
  
  @media print {
    .table thead tr th {
      -webkit-print-color-adjust: exact;
      background-color: #eeeeee !important;
    }
  
    .copyright {
      display: none;
    }
  }
  .rtl {
    direction: rtl;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }
  .rtl .invoice-information {
    float: left !important;
    text-align: left !important;
  }
  .rtl .invoice-head .client-info {
    text-align: right !important;
  }
  .rtl .invoice-head .client-data {
    text-align: left !important;
  }
  .rtl .invoice-body .table thead tr th {
    text-align: right !important;
  }
  .rtl .invoice-body .table tbody tr td {
    text-align: right !important;
  }
  .rtl .invoice-body .table tbody tr td:nth-child(2) {
    text-align: left !important;
  }
  .rtl .invoice-body .flex-table .flex-column .table-subtotal tbody tr td {
    text-align: right !important;
  }
  .rtl .invoice-body .flex-table .flex-column .table-subtotal tbody tr td:nth-child(2) {
    text-align: left !important;
  }
  .rtl .invoice-body .invoice-total-amount p {
    text-align: left !important;
  }
  td {
      text-align: center;  /* Centraliza o texto */
      justify-content: center; /* Centraliza o conteúdo */
  }
   
  </style>
    </head>
    <body>
      <section class="wrapper-invoice">
        <!-- switch mode rtl by adding class rtl on invoice class -->
        <div class="invoice">
          <div class="invoice-information">  
          <p><b>Data: </b> ${formattedDate}</p>
          </div>
          <!-- logo brand invoice -->
          <div class="invoice-logo-brand">
            <!-- <h2>Tampsh.</h2> -->
          <img src="${logoDataURI}" alt="Logo" />
          </div>
          <!-- invoice head -->
          <div class="invoice-head">
            <div class="head client-info">
              <p>Projeto da PAP.</p>
              <p>Gerado por: <strong>${req.user.name}</strong></p> 
            </div> 
          </div> 
  
          <div class="invoice-body">
              <h3>Status de pedido</h3>
              <br>
            <table class="table">
              <thead>
                <tr> 
                  <th>Não entregue</th>
                  <th>Cancelado</th>
                  <th>Concluído</th>
                </tr>
              </thead>
              <tbody>
                      <tr> 
                          <td style="text-align: center;">${inTransit}</td>
                          <td style="text-align: center;">${Cancelado}</td>
                          <td style="text-align: center;">${deliveredOrders}</td>
                      </tr>   
              </tbody>
            </table>
          </div> 
        </div>
      </section> 
    </body>
  </html>
      `;
  
      const options = { format: 'Letter' };
  
      pdf.create(htmlContent, options).toFile('./example.pdf', (err, resFile) => {
        if (err) {
          console.error('Erro ao criar o PDF:', err);
          return res.status(500).send('Erro ao processar a solicitação');
        }
        
        res.setHeader('Content-Disposition', 'attachment; filename="fatura.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
  
        const filestream = fs.createReadStream('./example.pdf');
        filestream.pipe(res);
  
        filestream.on('close', () => {
          fs.unlink('./example.pdf', (err) => {
            if (err) {
              console.error('Erro ao excluir o arquivo PDF:', err);
            }
          });
        });
      });
  
    } catch (error) {
      console.log("Erro ao criar dados do gráfico: " + error);
      res.status(500).send('Erro no servidor');
    }
}
  
exports.Cliente =  async (req, res) => {
    try {
      const cliente = await OrderModel.aggregate([
        { $match: { farmacia: req.user._id } },
        {
          $group: {
            _id: "$customer",
            totalSpent: { $sum: "$finalPrice" },
            totalQuantity: { $sum: "$totalQuantity" },
          },
        },
        {
          $lookup: {
            from: "userdetails",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
      ]);
  
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const day = date.getDate();
      const month = date.getMonth(); // Note que getMonth() retorna 0-11
      const year = date.getFullYear();
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const monthName = months[month];
      const formattedDate = `${day.toString().padStart(2, '0')} de ${monthName} de ${year}`;
      //{orderData[0].totalProducts
  
      const htmlContent = `
      
      <!DOCTYPE html>
  <html lang="en, id">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
  * {
    margin: 0 auto;
    padding: 0 auto;
    user-select: none;
  }
  
  body { 
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased; 
    font-size: 16px;
  }
  
  .wrapper-invoice {
    display: flex;
    justify-content: center;
  }
  .wrapper-invoice .invoice {
    height: auto;
    background: #fff;
    margin-top: 6vh; 
    padding: 3rem; 
    width: 100%;
    box-sizing: border-box; 
  }
  .wrapper-invoice .invoice .invoice-information {
    float: right;
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-information b {
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-information p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-logo-brand h2 {
    text-transform: uppercase;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    font-size: 2.9vh;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-logo-brand img {
    max-width: 220px;
    width: 100%;
    object-fit: fill;
  }
  .wrapper-invoice .invoice .invoice-head {
    display: flex;
    margin-top: 8vh;
  }
  .wrapper-invoice .invoice .invoice-head .head {
    width: 100%;
    box-sizing: border-box;
  }
  .wrapper-invoice .invoice .invoice-head .client-info {
    text-align: left;
  }
  .wrapper-invoice .invoice .invoice-head .client-info h2 {
    font-weight: 500;
    letter-spacing: 0.3px;
    font-size: 16px;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-head .client-info p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-head .client-data {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-head .client-data h2 {
    font-weight: 500;
    letter-spacing: 0.3px;
    font-size: 16px;
    color: "#0F172A";
  }
  .wrapper-invoice .invoice .invoice-head .client-data p {
    font-size: 16px;
    color: gray;
  }
  .wrapper-invoice .invoice .invoice-body {
    margin-top: 8vh;
  }
  .wrapper-invoice .invoice .invoice-body .table {
    border-collapse: collapse;
    width: 100%;
  }
  .wrapper-invoice .invoice .invoice-body .table thead tr th {
    font-size: 16px;
    border: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #eeeeee;
  }
  .wrapper-invoice .invoice .invoice-body .table tbody tr td {
    font-size: 16px;
    border: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #fff;
  }
  .wrapper-invoice .invoice .invoice-body .table tbody tr td:nth-child(2) {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table {
    display: flex;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column {
    width: 100%;
    box-sizing: border-box;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal {
    border-collapse: collapse;
    box-sizing: border-box;
    width: 100%;
    margin-top: 16px;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal tbody tr td {
    font-size: 16px;
    border-bottom: 1px solid #dcdcdc;
    text-align: left;
    padding: 1vh;
    background-color: #fff;
  }
  .wrapper-invoice .invoice .invoice-body .flex-table .flex-column .table-subtotal tbody tr td:nth-child(2) {
    text-align: right;
  }
  .wrapper-invoice .invoice .invoice-body .invoice-total-amount {
    margin-top: 1rem;
  }
  .wrapper-invoice .invoice .invoice-body .invoice-total-amount p {
    font-weight: bold;
    color: "#0F172A";
    text-align: right;
    font-size: 16px;
  }
  .wrapper-invoice .invoice .invoice-footer {
    margin-top: 4vh;
  }
  .wrapper-invoice .invoice .invoice-footer p {
    font-size: 1.7vh;
    color: gray;
  }
  
  .copyright {
    margin-top: 2rem;
    text-align: center;
  }
  .copyright p {
    color: gray;
    font-size: 1.8vh;
  }
  
  @media print {
    .table thead tr th {
      -webkit-print-color-adjust: exact;
      background-color: #eeeeee !important;
    }
  
    .copyright {
      display: none;
    }
  }
  .rtl {
    direction: rtl;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }
  .rtl .invoice-information {
    float: left !important;
    text-align: left !important;
  }
  .rtl .invoice-head .client-info {
    text-align: right !important;
  }
  .rtl .invoice-head .client-data {
    text-align: left !important;
  }
  .rtl .invoice-body .table thead tr th {
    text-align: right !important;
  }
  .rtl .invoice-body .table tbody tr td {
    text-align: right !important;
  }
  .rtl .invoice-body .table tbody tr td:nth-child(2) {
    text-align: left !important;
  }
  .rtl .invoice-body .flex-table .flex-column .table-subtotal tbody tr td {
    text-align: right !important;
  }
  .rtl .invoice-body .flex-table .flex-column .table-subtotal tbody tr td:nth-child(2) {
    text-align: left !important;
  }
  .rtl .invoice-body .invoice-total-amount p {
    text-align: left !important;
  }
  td {
      text-align: center;  /* Centraliza o texto */
      justify-content: center; /* Centraliza o conteúdo */
  }
   
  </style>
    </head>
    <body>
      <section class="wrapper-invoice">
        <!-- switch mode rtl by adding class rtl on invoice class -->
        <div class="invoice">
          <div class="invoice-information">  
          <p><b>Data: </b> ${formattedDate}</p>
          </div>
          <!-- logo brand invoice -->
          <div class="invoice-logo-brand">
            <!-- <h2>Tampsh.</h2> -->
          <img src="${logoDataURI}" alt="Logo" />
          </div>
          <!-- invoice head -->
          <div class="invoice-head">
            <div class="head client-info">
              <p>Projeto da PAP.</p>
              <p>Gerado por: <strong>${req.user.name}</strong></p> 
            </div> 
          </div> 
  
          <div class="invoice-body">
              <h3>1. Venda por dia</h3>
              <br>
            <table class="table">
              <thead>
                <tr> 
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Total gasto</th>
                  <th>Quantidade comprada</th>
                </tr>
              </thead>
              <tbody>
                  ${cliente.map(item => `
                      <tr> 
                          <td>${item.user.name}</td>
                          <td>${item.user.email}</td>
                          <td style="text-align: center;">${item.totalSpent.toFixed(2)} Kz</td>
                          <td style="text-align: center;">${item.totalQuantity} Kz</td>
                      </tr>   
                  `).join('')}
              </tbody>
            </table>
          </div> 
        </div>
      </section> 
    </body>
  </html>
      `;
  
      const options = { format: 'Letter' };
  
      pdf.create(htmlContent, options).toFile('./example.pdf', (err, resFile) => {
        if (err) {
          console.error('Erro ao criar o PDF:', err);
          return res.status(500).send('Erro ao processar a solicitação');
        }
        
        res.setHeader('Content-Disposition', 'attachment; filename="fatura.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
  
        const filestream = fs.createReadStream('./example.pdf');
        filestream.pipe(res);
  
        filestream.on('close', () => {
          fs.unlink('./example.pdf', (err) => {
            if (err) {
              console.error('Erro ao excluir o arquivo PDF:', err);
            }
          });
        });
      });
  
    } catch (error) {
      console.log("Erro ao criar dados do gráfico: " + error);
      res.status(500).send('Erro no servidor');
    }
}