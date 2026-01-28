const mongoose = require('mongoose');

const aoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    polygon: {
      type: {
        type: String,
        enum: ['Polygon'],
        required: [true, 'Polygon type is required']
      },
      coordinates: {
        type: [[[Number]]],
        required: [true, 'Polygon coordinates are required']
      }
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required']
    },
    style: {
      color: {
        type: String,
        trim: true,
        default: null
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
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AO', aoSchema);
