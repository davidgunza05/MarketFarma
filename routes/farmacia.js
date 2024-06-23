const express = require('express');
const router = express.Router();
const Farmacia = require('../models/farmacia/farmacia');
const ProdutoModel = require('../models/admin/product');
const ClienteModel = require("../models/user/details")
const OrderModel = require("../models/user/orders")
const CategoriaModel = require("../models/admin/category");
const download = require('../controllers/pdfController')
const sessionCheck = require("../middlewares/user/sessionCheck");
const Contacto = require("../models/farmacia/contacto");
const ContactoAdmin = require("../models/farmacia/contactoAdmin");
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
const Notification = require('../models/farmacia/notification')
const UserCLTN = require("../models/user/details");
require('../config/passport')(passport);
moment.locale('pt-br');

//#ROTAS DE CONTACTOS
router.get('/contactos',Auth, async (req, res) => {
  try{ 
    const contacts = await Contacto.find({farmacia: req.user._id}).sort({ _id: -1 })
      res.render('farmacia/mails', {  
        moment,
        farmacia: req.user, 
        contacts,  
      }) 

  }catch(err){
    console.log('erro ao renderizar email: ', err)
  }
})

router.get('/ler/contacto/:id',Auth, async (req, res) => { 
  try { 
    const currentMail = await Contacto.findById(req.params.id)
    res.render("farmacia/mailDetalhe.ejs", {
      currentMail,
      farmacia: req.user, 
      moment,
    });
  } catch (error) {
    console.log("erro ao renderizar email: " + error);
  }
  })

router.post('/contacto/:id', async(req, res) =>{
  try {
    const farmaciaId = req.params.id;
    req.body.farmacia = farmaciaId
    const newContacto = new Contacto(req.body);
    await newContacto.save();
    req.flash('success_msg', 'Mensagem enviada com com sucesso!')
    res.redirect(`/farmacia/enviar/contactar/${farmaciaId}`);
  } catch (error) {
    req.flash('error_msg', 'Erro ao enviar mensagem!')
    res.redirect(`/farmacia/enviar/contactar/${farmaciaId}`);
  }
})

router.get('/contactos/delete', async(req, res) => {
  try {
    const userId = req.query.id;
    const deleteUser = await Contacto.findByIdAndDelete(userId);
    req.flash('success_msg', 'Email deletado com sucesso')
    res.redirect("/farmacia/contactos");
  } catch (error) {
    console.log("Erro ao deletar email: " + error);
    res.redirect("/farmacia/contactos");
  }
})

router.get('/enviar/contactar/:id',sessionCheck, async (req, res) => {
  try {
    const userID = req.session.userID;
    const currentUser = await UserCLTN.findById(userID);
    const categories = await CategoriaModel.find({});
    const farmaciaId = req.params.id;
    const farmacia = await Farmacia.findById(farmaciaId);
    const produtos = await ProdutoModel.find({ farmacia: farmaciaId });

    if (!farmacia) {
      return res.status(404).send('Farmácia não encontrada');
    }

    res.render('index/contactarFarmacia', { 
      farmacia, 
      produtos, 
      details: categories,
      currentUser,
      session: req.session.userID,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro no servidor');
  }
});

router.get('/ver/contactar/admin', Auth, async (req, res) => {
  try {
    res.render("farmacia/contactarAdmin", {
      farmacia: req.user, 
    });
  } catch (error) {
    console.log("Erro ao renderizar página de contacto do admin: " + error);
  } 
})

router.post('/contactar/admin',Auth, async (req, res) =>{
  try {
    const newContacto = new ContactoAdmin(req.body);
    await newContacto.save();
    req.flash('success_msg', 'Mensagem enviada com sucesso ao Admin!')
    res.redirect("/farmacia/ver/contactar/admin");
  } catch (error) {
    req.flash('error_msg', 'Erro ao enviar mensagem!')
    res.redirect("/farmacia/ver/contactar/admin");
    console.log('Erro: ', error)
  }
})

//#ROTAS DE GERAR RELATÓRIOS
router
  .route("/total_fatura_gerar/pdf/vendido")
  .get(Auth, download.Total)

router
  .route("/status_pedido/pdf/download")
  .get(Auth, download.Status)

router
  .route("/cliente_fatura/pdf/download")
  .get(Auth, download.Cliente)


//#ROTAS DO MAPA 
router.get('/mapa/:id',Auth, async (req, res) => {
  try {
    const mapa = await Farmacia.findById(req.params.id);
    res.render('farmacia/mapa', { mapa, farmacia: req.user });
  } catch (err) {
    res.status(500).send('Erro ao carregar a farmácia');
  }
});

router.get('/ver/mapa/', async (req, res) => {
  try { 
    const categories = await CategoriaModel.find({});
    const farmacias = await Farmacia.find({ isActive: true });
    res.render('index/mapa', { farmacias, details: categories}); 
  } catch (err) {
    res.status(500).send('Erro ao carregar farmácias: ' + err.message);
  }
});
   
//# ROTAS DE AUTENTICAÇÃO
router.get('/', async (req, res) => {
  const categories = await CategoriaModel.find({});
  const farmacias = await Farmacia.find({isActive: true})
  res.render('index/farmacias', { 
    farmacias,
    details: categories,
  });
}); 

router.get('/pefil/:id', async (req, res) => {
  try {
    const userID = req.session.userID;
    const currentUser = await UserCLTN.findById(userID);
    const categories = await CategoriaModel.find({});
    const farmaciaId = req.params.id;
    const farmacia = await Farmacia.findById(farmaciaId);
    const produtos = await ProdutoModel.find({ farmacia: farmaciaId });

    if (!farmacia) {
      return res.status(404).send('Farmácia não encontrada');
    }

    res.render('index/profile', { 
      farmacia, 
      produtos, 
      details: categories,
      currentUser,
      session: req.session.userID,
    });
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
                  newFarmacia.save().then(farmacia => {
                      req.flash('success_msg', 'Farmácia registrada, entre em contacto com o admin para ativar a sua conta.');
                      res.redirect('/farmacia/login');
                    }).catch(err => {
                      req.flash('error_msg', 'Erro ao registrar a farmácia.');
                      res.redirect('/farmacia/registrar');
                      console.log(err)
                    })

                  const nomeFarma = req.body.name  
                  const notifique = new Notification({
                    type: 'Nova Farmácia',
                    message: `Tens uma nova farmácia cadastrada chamada: ${nomeFarma}`
                  })

                  notifique.save()
                  
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

router.post('/post/desconto/:id', async (req, res) =>{
  try {  
    const farmaciaId = req.params.id;
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

router.post('/cancel/:orderId', Auth, async (req, res) => {
  const { orderId } = req.params;
 
  try {
    const order = await OrderModel.findById(orderId).populate('summary.product');
    if (!order) {
      return res.status(404).json({ message: "Pedido não encontrado" });
    }

    if (order.farmacia.toString() !== req.user._id.toString()) {
      req.flash('error_msg', 'Você não tem permissão para cancelar este pedido')
      res.redirect(`/farmacia/farmacias/${orderId}/orders`);
    }

    order.status = "Cancelado";

    for (const item of order.summary) {
      const product = item.product;

      // Atualiza a quantidade em estoque
      product.stock += item.quantity;
      // Atualiza o número de unidades vendidas
      product.sold -= item.quantity;

      await product.save();
    }

    await order.save();
     
    req.flash('success_msg', 'Pedido cancelado com sucesso')
    res.redirect(`/farmacia/dashboard`);
  } catch (error) {
    console.error("Erro ao cancelar", error); 
    req.flash('error_msg', 'Erro ao cancelar o pedido')
    res.redirect(`/farmacia/dashboard`);
  }
});
module.exports = router;   