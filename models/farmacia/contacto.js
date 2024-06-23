const mongoose = require('mongoose');

const ContactoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  farma_ID:{
    type: String,
    required: true
  },
  farmacia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmacia'
  },
  email: {
    type: String,
    required: true
  }, 
  msg: {
    type: String,
    required: true
  },
  resposta: {
    type: String,
    default: 'Sem resposta ainda'
  },
  date: {
    type: Date,
    default: Date.now()
  }, 
});

const contactoCLTN = mongoose.model('Contacto', ContactoSchema);

module.exports = contactoCLTN;
