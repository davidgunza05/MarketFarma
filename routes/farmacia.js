const express = require('express');
const router = express.Router();
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
      

require('../config/passport')(passport);
moment.locale('pt-br');


//# ROTAS DE AUTENTICAÇÃO
 

router.get('/', async (req, res) => {
  const categories = await CategoriaModel.find({});
  const farmacias = await Farmacia.find({})
  res.render('index/farmacias', { 
    farmacias,
    details: categories,
  });
}); 

router.get('/pefil/:id', async (req, res) => {
  try {
    const categories = await CategoriaModel.find({});
    const farmaciaId = req.params.id;
    const farmacia = await Farmacia.findById(farmaciaId);
    const produtos = await ProdutoModel.find({ farmacia: farmaciaId });

    if (!farmacia) {
      return res.status(404).send('Farmácia não encontrada');
    }

    res.render('index/profile', { farmacia, produtos, details: categories,});
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro no servidor');
  }
});

router.get('/login', (req, res) => {
  res.render('farmacia/login')
}) 

router.get('/registrar', (req, res) => {
  res.render('farmacia/registrar')
})

router.post('/registrar', upload.fields([{ name: "thumbnail", maxCount: 1 }]), async (req, res) => {
    try{
      const { email, password, password2} = req.body;
   
      if (password != password2) {
        req.flash('error_msg', 'As senhas não são iguais.');
        res.redirect('/farmacia/registrar');
      }else{
    
        Farmacia.findOne({ email: email }).then(farmacia => {
            if (farmacia) {
              req.flash('error_msg', 'Este email já está registrado.');
              res.redirect('/farmacia/registrar');
            } else {

              let thumbnail = `${req.body.name}_${Date.now()}.WebP`;
              sharp(req.files.thumbnail[0].buffer).resize(500).toFile(`public/img/users/${thumbnail}`);
              req.body.thumbnail = thumbnail;

              const newFarmacia = new Farmacia(req.body);
      
              // Criptografar a senha
              bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(newFarmacia.password, salt, (err, hash) => {
                  if (err) throw err;
                  newFarmacia.password = hash;
                  newFarmacia.save()
                    .then(farmacia => {
                      req.flash('success_msg', 'Farmácia registrada, entre em contacto com o admin para ativar a sua conta.');
                      res.redirect('/farmacia/login');
                    })
                    .catch(err => {
                      req.flash('error_msg', 'Erro ao registrar a farmácia.');
                      res.redirect('/farmacia/registrar');
                      console.log(err)
                    });
                });
              });
            }
        })
        
      }
    }
    catch(err) {
      console.log('Erro ao cadastrar farmácia', err)
    }
  })

router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/farmacia/dashboard', // Redirecionar para o dashboard em caso de sucesso
    failureRedirect: '/farmacia/login', // Redirecionar de volta ao login em caso de falha
    failureFlash: true // Permitir mensagens flash
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) {
      console.error(err);
      req.flash('error_msg', 'Erro ao fazer logout');
      res.redirect('/farmacia/dashboard'); 
    } else {
      req.flash('success_msg', 'Logout com sucesso');
      res.redirect('/farmacia/login');
    }
  });
}); 


//# ROTAS DE PRODUTOS
router.get('/produtos', Auth, async (req, res) => {
  try {
    const allCategories = await CategoriaModel.find({});
    const seteDiasAntes = moment().add(7, 'days').toDate();  
    const allProducts = await ProdutoModel.find({ farmacia: req.user._id }).populate("category").sort({ _id: -1 })
    res.render("farmacia/produtos", {
      documentTitle: "Gerenciamento de produtos",
      categories: allCategories,
      products: allProducts, 
      farmacia: req.user, 
      moment,
      data: await ProdutoModel.find({ expiryDate: { $lte: seteDiasAntes }}),
    });
  } catch (error) {
    console.log("Erro ao renderizar página de produtos: " + error);
  } 
})

router.get('/editar/produto', Auth,  async (req, res) => {
  try {
    const currentProduct = await ProdutoModel.findById(req.query.id) .populate("category");
    const categories = await CategoriaModel.find({});
    res.render("farmacia/editarProduto", {
      session: req.session.admin,
      documentTitle: "Editar produtos",
      product: currentProduct,
      categories: categories,
      farmacia: req.user,
    });
  } catch (error) {
    console.log("Erro ao redirecionar página produto " + error);
  } 
}); 

router.post('/editar/produto', Auth,  upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 } ,
]), async (req, res) => {
  try { 
    const { expiryDate } = req.body;
    const currentDate = new Date();
    const oneMonthFromNow = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
  
    const nameCheck = await ProdutoModel.findOne({ name: req.body.name });

    if (new Date(expiryDate) < oneMonthFromNow) {

      req.flash('error_msg', 'A data de expiração deve ser maior que um mês a partir da data atual.')
      res.redirect('/farmacia/produtos');

    }else{

    if (JSON.stringify(req.files) !== "{}") {

      if (req.files.frontImage) {
        let frontImage = `${req.body.name}_frontImage_${Date.now()}.WebP`;
        sharp(req.files.frontImage[0].buffer)
        .resize(500)
          .toFile(`public/img/products/${frontImage}`);
        req.body.frontImage = frontImage;
      }

      if (req.files.thumbnail) {
        let thumbnail = `${req.body.name}_thumbnail_${Date.now()}.WebP`;
        sharp(req.files.thumbnail[0].buffer)
        .resize(500)
          .toFile(`public/img/products/${thumbnail}`);
        req.body.thumbnail = thumbnail;
      } 
    }
    req.body.category = mongoose.Types.ObjectId(req.body.category);
    await ProdutoModel.findByIdAndUpdate(req.query.id, req.body);
    req.flash('success_msg', 'Produto editado com sucesso!')
    res.redirect("/farmacia/produtos");
    }

  } catch (error) {
    console.log("Erro ao editar produto: " + error);
  }
}); 

router.post('/add-produto/:id',   upload.fields([
  { name: "frontImage", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 } ,
]), async (req, res) => {
  try {
    const farmaciaId = req.params.id;
    const { expiryDate } = req.body;
    const currentDate = new Date();
    const oneMonthFromNow = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate());
  
    const nameCheck = await ProdutoModel.findOne({ name: req.body.name });


    if (new Date(expiryDate) < oneMonthFromNow) {

      req.flash('error_msg', 'A data de expiração deve ser maior que um mês a partir da data atual.')
      res.redirect('/farmacia/produtos');
    
    }else if(nameCheck){
      req.flash('error_msg', 'Já existe produto com este nome.')
      res.redirect('/farmacia/produtos');
    }else{

      
      let frontImage = `${req.body.name}_frontImage_${Date.now()}.WebP`;
      sharp(req.files.frontImage[0].buffer)
      .resize(500)
        .toFile(`public/img/products/${frontImage}`);
      req.body.frontImage = frontImage;

      let thumbnail = `${req.body.name}_thumbnail_${Date.now()}.WebP`;
      sharp(req.files.thumbnail[0].buffer)
      .resize(500)
        .toFile(`public/img/products/${thumbnail}`);
      req.body.thumbnail = thumbnail;
    
      req.body.category = mongoose.Types.ObjectId(req.body.category);
      req.body.farmacia = farmaciaId
      const newProduct = new ProdutoModel(req.body);
      await newProduct.save();
      req.flash('success_msg', 'Produto criado com sucesso!')
      res.redirect('/farmacia/produtos');
    }
  } catch (error) {
    console.log("Erro ao criar produto: " + error);
  }
});

router.get('/produtos/delete_product', Auth, async(req, res) =>{
  try {
    const productId = req.query.id;
    const deleteproduct = await ProdutoModel.findByIdAndDelete(productId);
    req.flash('success_msg', 'Produto deletado com sucesso')
    res.redirect("/farmacia/produtos");
  } catch (error) {
    console.log("Error ao deletar produto: " + error);
  }
})
// Adicionando a identificação da farmácia ao produto
//const farmaciaId = req.params.id;
//req.body.farmacia = farmaciaId;


//# ROTAS DA DASHBOARD
router.get('/dashboard', Auth, async (req, res) => {
  try {
    const farmaciaId = req.user._id;

    const recentOrders = await OrderModel.find({ farmacia: farmaciaId })
      .sort({ _id: -1 })
      .populate({ path: 'customer', select: 'email' });
    const orderCount = recentOrders.length;
    const customerCount = await ClienteModel.countDocuments();
    const productCount = await ProdutoModel.countDocuments({ farmacia: farmaciaId });

    const allProducts = await ProdutoModel.find({ farmacia: farmaciaId });

    // Data de expiração
    const notificarAdmin = async () => {
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const expiringProducts = await ProdutoModel.find({
        farmacia: farmaciaId,
        expiryDate: { $lte: oneWeekFromNow }
      }).populate('category');

      if (expiringProducts.length > 0) {
        req.flash('error_msg', `Encontrados ${expiringProducts.length} produtos próximos da expiração.`);
        console.log('Alguns produtos vão expirar em breve');
      }
    };

    // Agendar a execução da verificação a cada dia às 9h da manhã
    cron.schedule('0 9 * * *', notificarAdmin);

    let totalRevenue = 0;
    if (customerCount) {
      const revenueResult = await OrderModel.aggregate([
        { $match: { farmacia: farmaciaId } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$finalPrice' }
          }
        }
      ]);
      if (revenueResult.length > 0) {
        totalRevenue = revenueResult[0].totalRevenue;
      }
    }

    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const vendasResult = await OrderModel.aggregate([
      {
        $match: {
          farmacia: farmaciaId,
          orderedOn: { $gte: startOfMonth, $lte: endOfMonth },
          delivered: true
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$finalPrice' }
        }
      }
    ]);

    const vendaDesteMes = vendasResult.length > 0 ? vendasResult[0].totalRevenue : 0;
    const mesAtual = moment().format('MMMM');
    if (req.isAuthenticated()) {
      res.render('farmacia/dashboard', {
        session: req.session.admin,
        recentOrders,
        moment,
        totalRevenue,
        orderCount,
        customerCount,
        productCount,
        mesAtual,
        farmacia: req.user,
        allProducts,
        vendaDesteMes,
        documentTitle: 'Painel Farmácia'
      });
    } else {
      req.flash('error_msg', 'Você precisa estar logado para acessar esta página');
      res.redirect('/farmacia/login');
    }
  } catch (error) {
    console.log('Erro ao renderizar dashboard: ' + error);
    res.status(500).send('Erro no servidor');
  }
});


/*Criei um ecommerce farmaceutico, tenho customers, admin. agora quero ter a parte dos vendedores(farmácias). Quero as seguintes funcionalidades para os vendedores (Farmácias):
- Postar, eliminar e editar seus respetivos produtos
- Ver total de produtos cadastrados
- Ver total de vendas realizadas
- VER TODAS AS suas vendas e detalhe de cada venda
- Dashboard (com dados relevantes de compras como gráficos)
- Relatórios de suas vendas

Use node.js + mongodb + ejs*/


//ROTAS DE ORDERS

router.get('/farmacias/:id/orders', Auth, async (req, res) => {
  try {
    const farmaciaId = req.params.id;
    const orders = await OrderModel.find({ farmacia: farmaciaId }).populate('customer').populate('summary.product');

    if (!orders) {
      return res.status(404).send('Nenhuma ordem encontrada para esta farmácia');
    }
    res.render('farmacia/orders', { orders, farmacia: req.user,moment});
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro no servidor');
  }
});

router.get('/order/detalhe/:id', Auth, async (req, res) => {
  try { 
    const currentOrder = await OrderModel
      .findById(req.params.id)
      .populate("summary.product")
      .populate("couponUsed")
      .populate("customer", "name email")
      res.render("farmacia/detalheCompra", {
      farmacia: req.user,
      currentOrder,
      moment,
      documentTitle: "Detalhes do pedido",
    });
  } catch (error) {
    console.log("Erro ao renderizar detalhe de pedido: " + error);
  }
});

router.get('/fatura/pdf/:id', Auth, (req, res) => {
  const compraId = req.params.id;
  OrderModel.findById(compraId, (err, compra) => {
    if (err || !compra) {
      return res.status(404).send('Compra não encontrada');
    }

    // Gerar o PDF
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(`fatura_${compraId}.pdf`);
    doc.pipe(stream);

    doc.text(`ID do pedido: ${compra._id.toString('hex').slice(0, 10)}`);
    doc.text(`Pedido em : ${moment(compra.orderedOn).format('LLL')}`);
    doc.text(` `);
    doc.text(`==================================================================`);
    doc.text(`Produtos:`);
    doc.text(` `);
     if(compra.summary != null){ 
      compra.summary.forEach((product,i)=> {
        doc.text(`${i+1}.${product.product.name} / ${product.quantity} / ${product.totalPrice} KZ`);
      })
    }
    doc.text(` `);
    doc.text(` `);
    doc.text(`Endereço para entrega:`);
    doc.text(` `);
    if(compra.shippingAddress!=""){ 
      doc.text(`Província: ${compra.shippingAddress.provincia}`);
      doc.text(`Município / Distrito: ${compra.shippingAddress.municipio}`);
      doc.text(`Bairro / Outro: ${compra.shippingAddress.bairro}`);
      doc.text(`Prédio: ${compra.shippingAddress.predio} - Casa / Aprt Nº: ${compra.shippingAddress.pincode}`);
      doc.text(`Contacto: ${compra.shippingAddress.contacto}`);
    }
    doc.text(`==================================================================`);
    doc.text(` `);
    doc.text(`Nome do cliente: ${compra.customer.name}`);
    doc.text(`Email do cliente: ${compra.customer.email}`);
    doc.text(` `);
    doc.text(` `); 
    doc.text(`Quantidade total: ${compra.totalQuantity}`);
    doc.text(`Forma de pagamento: ${compra.modeOfPayment}`);

    if(compra.couponUsed){ 
      doc.text(`Desconto usuado: ${compra.couponUsed.name}`);
    }else{
      doc.text(`Nenhum desconto usado`);
    }
    doc.text(``);
    doc.text(`Preço: ${compra.price} KZ`);
    doc.text(`Preço com desconto: ${compra.discountPrice} KZ`);
    doc.text(`Preço final: ${compra.finalPrice} KZ`);
    doc.text(``);

    if(compra.delivered==true){
      doc.text(`Estado do Pedido: Concluído em ${moment(compra.orderedOn).format('LLL')}`);
    }else{
      doc.text(`${compra.status}`);
    } 

    doc.end();

    stream.on('finish', () => {
      // Envie o arquivo PDF para download
      res.download(`fatura_${compraId}.pdf`, `fatura_${compraId}.pdf`, (err) => {
        if (err) {
          console.error('Erro ao baixar a fatura:', err);
        }
        // Exclua o arquivo PDF após o download
        fs.unlink(`fatura_${compraId}.pdf`, (err) => {
          if (err) {
            console.error('Erro ao excluir o arquivo PDF:', err);
          }
        });
      });
    });
  }).populate("summary.product").populate("couponUsed").populate("customer", "name email");
});

router.get('/orders/delete_order', Auth, async (req, res) => {
  try {
    const orderrId = req.query.id;
    const deleteUser = await OrderModel.findByIdAndDelete(orderrId);
    req.flash('success_msg', 'Pedido deletado com sucesso')
    res.redirect("/farmacia/orders");
  } catch (error) {
    console.log("Erro ao deletar pedido: " + error);
  }
});

router.patch('/orders', Auth, async (req, res) =>{
  try {
    await OrderModel.findByIdAndUpdate(req.body.orderID, {
      $set: {
        delivered: true,
        deliveredOn: Date.now(),
      },
    });
    res.json({
      data: { delivered: 1 },
    });
  } catch (error) {
    console.log("Erro ao entregar o pedidod: " + error);
  }
})

//# ROTA DE RELATÓRIOS

//Gráficos
router.put('/dashboard', async (req, res) => {
  try {
    const farmaciaId = req.user._id; // Assumindo que o ID da farmácia está disponível em req.user._id
    let currentYear = new Date();
    currentYear = currentYear.getFullYear();

    // Agregação para dados mensais
    const orderData = await OrderModel.aggregate([
      {
        $match: { farmacia: farmaciaId } // Filtra pela farmácia
      },
      {
        $project: {
          _id: 0,
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
      {
        $match: { "_id.year": currentYear },
      },
      {
        $sort: { "_id.month": 1 },
      },
    ]);

    // Agregação para dados diários
    const dailyOrderData = await OrderModel.aggregate([
      {
        $match: { farmacia: farmaciaId } // Filtra pela farmácia
      },
      {
        $project: {
          _id: 0,
          totalProducts: "$totalQuantity",
          billAmount: "$finalPrice",
          month: { $month: "$orderedOn" },
          year: { $year: "$orderedOn" },
          day: { $dayOfMonth: "$orderedOn" },
          week: { $isoWeek: "$orderedOn" },
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
      {
        $match: { "_id.year": currentYear },
      },
      {
        $sort: { "_id.month": 1, "_id.day": 1 },
      },
    ]);

    // Contar ordens entregues
    const deliveredOrders = await OrderModel.find({ farmacia: farmaciaId, delivered: true }).countDocuments();

    // Agregação para ordens não entregues
    const notDelivered = await OrderModel.aggregate([
      {
        $match: { farmacia: farmaciaId, delivered: false } // Filtra pela farmácia
      },
      {
        $group: {
          _id: "$status",
          status: { $sum: 1 },
        },
      },
    ]);

    let inTransit;
    let Cancelado = 0;
    notDelivered.forEach((order) => {
      if (order._id === "Processando") {
        inTransit = order.status;
      } else if (order._id === "Cancelado") {
        Cancelado = order.status;
      }
    });

    const delivered = deliveredOrders;
    res.json({
      data: { orderData, dailyOrderData, inTransit, Cancelado, delivered },
    });
  } catch (error) {
    console.log("Erro ao criar dados do gráficos: " + error);
    res.status(500).send('Erro no servidor');
  }
});


router.get('/total_vendido', Auth, async (req, res) => {
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

    let inTransit = 0;
    let Cancelado = 0;
    notDelivered.forEach(order => {
      if (order._id === "Processando") {
        inTransit = order.status;
      } else if (order._id === "Cancelado") {
        Cancelado = order.status;
      }
    });

    res.render('farmacia/relatorios/total', {
      orderData,
      inTransit,
      Cancelado,
      delivered: deliveredOrders,
      pdfLink: '/farmacia/total_vendido/pdf',
      dailyOrderData,
      farmacia: req.user,
      documentTitle: 'Relatórios de venda',
    });
  } catch (error) {
    console.log("Erro ao criar dados do gráfico: " + error);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para produtos mais vendidos
router.get('/mais_vendidos', Auth, async (req, res) => {
  try {
    const mostSoldDaily = await OrderModel.aggregate([
      { $match: { farmacia: req.user._id } },
      { $unwind: "$summary" },
      {
        $project: {
          month: { $month: "$orderedOn" },
          day: { $dayOfMonth: "$orderedOn" },
          product: "$summary.product",
          quantity: "$summary.quantity",
        },
      },
      {
        $group: {
          _id: { month: "$month", day: "$day", product: "$product" },
          quantity: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.month": 1, "_id.day": 1, quantity: -1 } },
      {
        $group: {
          _id: { month: "$_id.month", day: "$_id.day" },
          products: { $push: { product: "$_id.product", quantity: "$quantity" } },
        },
      },
    ]);

    const mostSoldMonthly = await OrderModel.aggregate([
      { $match: { farmacia: req.user._id } },
      { $unwind: "$summary" },
      {
        $project: {
          month: { $month: "$orderedOn" },
          product: "$summary.product",
          quantity: "$summary.quantity",
        },
      },
      {
        $group: {
          _id: { month: "$month", product: "$product" },
          quantity: { $sum: "$quantity" },
        },
      },
      { $sort: { "_id.month": 1, quantity: -1 } },
      {
        $group: {
          _id: "$_id.month",
          products: { $push: { product: "$_id.product", quantity: "$quantity" } },
        },
      },
    ]);

    res.render("farmacia/relatorios/maisVendido", {
      mostSoldDaily,
      farmacia: req.user,
      mostSoldMonthly,
      documentTitle: 'Relatórios de venda',
    });
  } catch (error) {
    console.log("Error retrieving most sold products: " + error);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para status de pedidos
router.get('/status_pedido', Auth, async (req, res) => {
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

    let inTransit = 0;
    let Cancelado = 0;
    notDelivered.forEach(order => {
      if (order._id === "Processando") {
        inTransit = order.status;
      } else if (order._id === "Cancelado") {
        Cancelado = order.status;
      }
    });

    res.render('farmacia/relatorios/status', {
      orderData,
      farmacia: req.user,
      inTransit,
      Cancelado,
      delivered: deliveredOrders,
      dailyOrderData,
      documentTitle: 'Relatórios de venda',
    });
  } catch (error) {
    console.log("Erro ao criar dados do gráfico: " + error);
    res.status(500).send('Erro no servidor');
  }
});

// Rota para clientes que mais compraram
router.get('/clientes_mais_pedidos', Auth, async (req, res) => {
  try {
    const results = await OrderModel.aggregate([
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

    res.render("farmacia/relatorios/porCliente", {
      farmacia: req.user,
      results,
      documentTitle: 'Relatórios de venda',
    });
  } catch (error) {
    console.log("Erro ao recuperar clientes que mais compraram: " + error);
    res.status(500).send('Erro no servidor');
  }
});


//# ROTAS ADICIONAIS

router.get('/desconto', Auth, async (req, res) => {
  try {
    const coupons = await DesconontoModel.find({farmacia: req.user._id});
    res.render("farmacia/desconto", {
      farmacia: req.user,
      documentTitle: "Gerenciamento de desconto",
      coupons,
      moment,
    });
  } catch (error) {
    console.log("Erro ao renderizar página de código de descontos: " + error);
  }
})

router.post('/desconto', async (req, res) =>{
  try {  
    const newCoupon = new DesconontoModel({
      name: req.body.name,
      code: req.body.code,
      discount: req.body.discount,
      startingDate: req.body.startingDate,
      expiryDate: req.body.expiryDate,
      farmacia: req.body.farmacia,
    });
    
    if(req.body.startingDate > req.body.expiryDate){
      req.flash('error_msg', 'Data de expiração deve ser maior que a data de começo e as duas datas devem ser maior que a data atual')
      res.redirect("farmacia/desconto");
    }else{
      await newCoupon.save();
      res.redirect("farmacia/desconto");
    }

  } catch (error) {
    console.log("Erro ao adicionar página de desconto: " + error);
  }
})

//# ROTA EDITAR PERFIL 
router.get('/editar/:id', Auth,  async (req, res) => {
  try {
    const Dados = await Farmacia.findById(req.params.id);
    res.render('farmacia/editar', { farmacia: req.user, Dados });
  } catch (err) {
    res.status(500).send(err);
  }
});

//#ROTA PARA POST DE EDITAR FARMÁCIA 
// Rota para atualizar as informações da farmácia
router.post('/editar/:id', Auth, upload.fields([{ name: "thumbnail", maxCount: 1 }]), async (req, res) => {
  try {
    if (JSON.stringify(req.files) !== "{}") {
      if (req.files.thumbnail) {
        let thumbnail = `${req.body.name}_thumbnail_${Date.now()}.WebP`;
        sharp(req.files.thumbnail[0].buffer).resize(500).toFile(`public/img/users/${thumbnail}`);
        req.body.thumbnail = thumbnail;
      }
    }
    await Farmacia.findByIdAndUpdate(req.params.id, req.body);
    req.flash('success_msg', 'Farmácia editada com sucesso')
    res.redirect(`/farmacia/editar/${req.params.id}`);
  } catch (err) {
    res.status(500).send(err);
  }
})


//ROTA PARA GERAR PDF DOS RELATÓRISO 
// Existing route with PDF download option
 


router.get('/total_fatura_gerar/pdf/vendido', Auth, async (req, res) => {
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
  padding: 5vh;
  margin-top: 6vh; 
  padding: 6rem; 
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
  max-width: 100px;
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
td{
  text-center;
  justify-content-center
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
          <img src="logo_dark.png" alt="" />
        </div>
        <!-- invoice head -->
        <div class="invoice-head">
          <div class="head client-info">
            <p>Projeto da PAP.</p>uyuu n
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
                <td>${orderData[0]._id.month}/${orderData[0]._id.year}</td>
                <td>${orderData[0].totalProducts}</td>
                <td>${orderData[0].totalOrders}</td>
                <td>${orderData[0].revenue}</td>
                <td>${orderData[0].avgBillPerOrder}</td> 
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
                        <td>${dailyOrder.totalOrders}</td>
                        <td>${dailyOrder.totalProducts}</td>
                        <td>${dailyOrder.revenue} Kz</td>
                        <td>${dailyOrder.avgBillPerOrder} Kz</td>
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
});




module.exports = router;   