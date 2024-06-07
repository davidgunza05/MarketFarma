const mongoose = require('mongoose');

const FarmaciaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: { 
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  municipio: {
    type: String,
    required: true
  },
  endereco: {
    type: String,
    required: true
  },
  provincia: {
    type: String,
    required: true
  },
  thumbnail: {
    type: String, 
  },
  descricao: {
    type: String, 
  },
  numero: {
    type: Number,
  },
  date: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: false
  },
  latitude: {
    type: Number,  // Adiciona latitude 
  },
  longitude: {
    type: Number,  // Adiciona longitude 
  }
});

const Farmacia = mongoose.model('Farmacia', FarmaciaSchema);

module.exports = Farmacia;
