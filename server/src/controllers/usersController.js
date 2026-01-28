const User = require('../models/User');

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching users',
      details: error.message
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching user',
      details: error.message
    });
  }
};

const getUsersNearby = async (req, res) => {
  try {
    const { lat, lng, distance = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const maxDistance = parseFloat(distance) * 1000;

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates'
      });
    }

    const users = await User.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          location: 1,
          createdAt: 1,
          distance: { $round: [{ $divide: ["$distance", 1000] }, 2] }
        }
      },
      {
        $sort: { distance: 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        users,
        center: {
          lat: latitude,
          lng: longitude,
          radius: parseFloat(distance)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error fetching nearby users',
      details: error.message
    });
  }
};

const updateMyLocation = async (req, res) => {
  try {
    const { coordinates } = req.body;
    const [longitude, latitude] = coordinates;

    req.user.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };

    await req.user.save();

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating location',
      details: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getUsersNearby,
  updateMyLocation
};