const mongoose = require("mongoose");
const categoryCLTN = require("./category");

const productSchema = new mongoose.Schema({
  farmacia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmacia'
  },
  name: {
    type: String,
    require,
  },
  category: {
    type: mongoose.Types.ObjectId,
    ref: categoryCLTN,
    require,
  },
  dosagem: {
    type: String,
    default: "100mg",
  },
  fabricante: {
    type: String,
    require,
  },
  price: {
    type: Number,
    require,
  }, 
  expiryDate: Date,
  descricao: {
    type: String,
    require,
  }, 
  sold: {
    type: Number,
    default: 0,
  },
  efeitos_colaterais: {
    type: String,
    require,
  },
  composicao: {
    type: String,
    require,
  }, 
  thumbnail: {
    type: String,
    require,
  }, 
  frontImage:{
    tuype: String, 
  },
  reviews: [{
    user: String,
    email: String,
    rating: Number,
    comment: String
  }],
  
  images: [String],
  stock: Number,
  listed: { type: Boolean, default: true },
});


const productCLTN = mongoose.model("Products", productSchema);
module.exports = productCLTN;