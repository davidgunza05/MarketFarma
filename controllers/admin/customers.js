const { findById, findByIdAndUpdate } = require("../../models/admin/details");
const UserCLTN = require("../../models/user/details");
const OrderModel = require("../../models/user/orders");
const contactoCLTN = require("../../models/farmacia/contactoAdmin");

exports.viewAll = async (req, res) => {
  try {
    const allCustomers = await UserCLTN.find().sort({ name: -1 });
    res.render("admin/partials/customers", {
      session: req.session.admin,
      allCustomers,
      documentTitle: "Gerenciamento de usuários",
    });
  } catch (error) {
    console.log("Erro ao listar todos clientes: " + error);
  }
};

exports.changeAccess = async (req, res) => {
  try {
    let currentAccess = req.body.currentAccess === "true";
    currentAccess = !currentAccess
    await UserCLTN.findByIdAndUpdate(req.body.userID, {
      access: currentAccess,
    });
    res.json({
      data: { newAccess: currentAccess },
    });
  } catch (error) {
    console.log("Error changing user access: " + error);
  }
};

exports.deleteCustomers = async (req, res) => {
  try {
    const userId = req.query.id;
    
    // Deleta o usuário pelo ID
    const deleteUser = await UserCLTN.findByIdAndDelete(userId);

    // Deleta todas as compras associadas a esse usuário
    await OrderModel.deleteMany({ userId: userId });

    req.flash('success_msg', 'Cliente e suas compras deletados com sucesso');
    res.redirect("/admin/customer_management");
  } catch (error) {
    console.log("Erro ao deletar cliente: " + error);
    req.flash('error_msg', 'Erro ao deletar cliente e suas compras');
    res.redirect("/admin/customer_management");
  }
};

exports.deleteContacto = async (req, res) => {
  try {
    const userId = req.query.id;
    const deleteUser = await contactoCLTN.findByIdAndDelete(userId);
    req.flash('success_msg', 'Email deletado com sucesso')
    res.redirect("/admin/mail_management");
  } catch (error) {
    console.log("Erro ao deletar email: " + error);
    res.redirect("/admin/mail_management");
  }
}