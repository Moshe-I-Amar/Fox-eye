const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null
    },
    commanderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    active: {
      type: Boolean,
      default: true
    },
    color: {
      type: String,
      trim: true,
      default: '#C7A76C'
    },
    pattern: {
      type: String,
      trim: true,
      default: null
    },
    icon: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Company', companySchema);
