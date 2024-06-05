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

router.post('/registrar', upload.fields([{ name: "thumbnail", maxCount: 1 }]), (req, res) => {
  const { name, email, password, password2 } = req.body;
  let errors = [];

  if (!name || !email || !password || !password2) {
    errors.push({ msg: 'Please enter all fields' });
  }

  if (password != password2) {
    errors.push({ msg: 'Passwords do not match' });
  }

  if (password.length < 6) {
    errors.push({ msg: 'Password must be at least 6 characters' });
  }

  if (errors.length > 0) {
    return res.render('farmacia/registrar', { errors });
  }

  if (!req.files || !req.files.thumbnail) {
    errors.push({ msg: 'Please upload a thumbnail image' });
    return res.render('farmacia/registrar', { errors });
  }

  let thumbnail = `${req.body.name}_thumbnail_${Date.now()}.webp`;
  sharp(req.files.thumbnail[0].buffer)
    .resize(500)
    .toFile(`public/img/users/${thumbnail}`)
    .then(() => {
      req.body.thumbnail = thumbnail;

      Farmacia.findOne({ email: email }).then(farmacia => {
        if (farmacia) {
          errors.push({ msg: 'Email already exists' });
          return res.render('farmacia/registrar', { errors });
        }

        const newFarmacia = new Farmacia(req.body);

        bcrypt.genSalt(10, (err, salt) => {
          if (err) throw err;
          bcrypt.hash(newFarmacia.password, salt, (err, hash) => {
            if (err) throw err;
            newFarmacia.password = hash;
            newFarmacia.save()
              .then(farmacia => {
                req.flash('success_msg', 'You are now registered and can log in');
                res.redirect('/farmacia/login');
              })
              .catch(err => console.log(err));
          });
        });
      });
    })
    .catch(err => {
      console.error('Error processing image:', err);
      errors.push({ msg: 'Error processing image' });
      res.render('farmacia/registrar', { errors });
    });
});

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


module.exports = router;  