// ========================= SEED APIS (ALL IN ONE - FIXED) =========================
import express from "express";
import User from "../models/user.model.js";
import Property from "../models/property.model.js";
import Contact from "../models/contact.model.js";

const router = express.Router();

// =====================================================
// INDIA REAL LOCATIONS
// =====================================================
const LOCATIONS = [
  { city: "Noida", state: "UP", locality: "Sector 62", pincode: "201309" },
  { city: "Gurgaon", state: "Haryana", locality: "DLF Phase 3", pincode: "122002" },
  { city: "Delhi", state: "Delhi", locality: "Laxmi Nagar", pincode: "110092" },
  { city: "Mumbai", state: "Maharashtra", locality: "Andheri East", pincode: "400069" },
  { city: "Pune", state: "Maharashtra", locality: "Hinjewadi", pincode: "411057" },
  { city: "Bangalore", state: "Karnataka", locality: "Whitefield", pincode: "560066" },
  { city: "Hyderabad", state: "Telangana", locality: "Madhapur", pincode: "500081" },
  { city: "Chennai", state: "Tamil Nadu", locality: "Velachery", pincode: "600042" },
  { city: "Jaipur", state: "Rajasthan", locality: "Malviya Nagar", pincode: "302017" },
  { city: "Indore", state: "MP", locality: "Vijay Nagar", pincode: "452010" },
];

// =====================================================
// 1️⃣ SEED 20 USERS
// =====================================================
router.post("/users", async (req, res) => {
  try {
    const users = [];

    for (let i = 1; i <= 20; i++) {
      users.push({
        name: `Dummy User ${i}`,
        email: `dummy${i}@gmail.com`,
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        password: "$2b$10$4YQWkLI9haPDc/aC0xkW9O7WF1iofgMsQJVgSHccsYfpwmyt8F1Ra", // bcrypt hook handle karega
        avatar: `https://i.pravatar.cc/150?img=${i}`,
        role: i === 1 ? "admin" : "user",
        address: {
          houseNo: `${i}A`,
          street: "MG Road",
          locality: "Sector 15",
          city: "Noida",
          district: "Gautam Budh Nagar",
          state: "UP",
          pincode: "201301",
          country: "India",
        },
        kyc: {
          aadhaarNumber: `12341234123${i}`,
          panNumber: `ABCDE12${i}F`,
          isVerified: i % 2 === 0,
        },
        isBlocked: false,
        lastLogin: new Date(),
      });
    }

    await User.insertMany(users);

    res.json({
      success: true,
      message: "20 users seeded",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// 2️⃣ SEED 50 PROPERTIES (AUTO OWNER FROM DB + VIDEO)
// =====================================================
router.post("/properties", async (req, res) => {
  try {
    const users = await User.find().select("_id");

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: "No users found. Seed users first.",
      });
    }

    const properties = [];

    for (let i = 1; i <= 50; i++) {
      const location = LOCATIONS[i % LOCATIONS.length];
      const owner = users[i % users.length]._id;

      properties.push({
        title: `${location.locality} ${i % 2 ? "Luxury" : "Budget"} Property`,
        description:
          "Prime location property with modern amenities. Ready to move.",
        purpose: i % 2 === 0 ? "sell" : "rent",
        propertyType: ["flat", "house", "plot", "shop", "office", "apartment"][i % 6],
        price: i % 2 === 0 ? 4500000 + i * 30000 : 12000 + i * 800,
        area: { size: 850 + i * 25, unit: "sqft" },
        bedrooms: (i % 4) + 1,
        bathrooms: (i % 3) + 1,
        furnishing: ["furnished", "semi-furnished", "unfurnished"][i % 3],
        address: {
          city: location.city,
          state: location.state,
          locality: location.locality,
          pincode: location.pincode,
        },
        images: [
          `https://picsum.photos/seed/property${i}/600/400`,
          `https://picsum.photos/seed/property${i + 100}/600/400`,
        ],
        // 🎥 VIDEO
        video:
          "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
        owner,
        views: Math.floor(Math.random() * 1000),
        isActive: true,
        isFlagged: false,
      });
    }

    await Property.insertMany(properties);

    res.json({
      success: true,
      message: "50 properties seeded (owners auto-linked)",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// 3️⃣ SEED 100 CONTACTS (AUTO BUYER + OWNER)
// =====================================================
router.post("/contacts", async (req, res) => {
  try {
    const properties = await Property.find().select("_id owner");
    const users = await User.find().select("_id");

    if (!properties.length || !users.length) {
      return res.status(400).json({
        success: false,
        message: "Users or properties missing",
      });
    }

    const messages = [
      "Is this property available?",
      "Can I visit tomorrow?",
      "Is price negotiable?",
      "Please share more details.",
      "Interested, please call me.",
      "Loan available?",
      "Ready to move?",
      "Maintenance cost?",
      "Exact location?",
      "Best final price?",
    ];

    const contacts = [];

    for (let i = 0; i < 100; i++) {
      const property = properties[i % properties.length];

      let buyer;
      do {
        buyer = users[Math.floor(Math.random() * users.length)];
      } while (buyer._id.toString() === property.owner.toString());

      contacts.push({
        property: property._id,
        owner: property.owner,
        buyer: buyer._id,
        message: messages[i % messages.length],
        createdAt: new Date(Date.now() - Math.random() * 30 * 86400000),
      });
    }

    await Contact.insertMany(contacts);

    res.json({
      success: true,
      message: "100 contacts seeded",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// 4️⃣ SEED EVERYTHING (ORDER SAFE)
// =====================================================
router.post("/all", async (req, res) => {
  await User.deleteMany({});
  await Property.deleteMany({});
  await Contact.deleteMany({});

  await router.handle({ method: "POST", url: "/users" }, res, () => {});
  await router.handle({ method: "POST", url: "/properties" }, res, () => {});
  await router.handle({ method: "POST", url: "/contacts" }, res, () => {});

  res.json({
    success: true,
    message: "ALL DATA SEEDED (users → properties → contacts)",
  });
});

export default router;
