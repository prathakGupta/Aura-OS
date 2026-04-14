import admin from "../config/firebase.js";
import User from "../models/User.js";

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split("Bearer ")[1];

    const decodedToken = await admin.auth().verifyIdToken(token);

    const user = await User.findOne({ firebaseUid: decodedToken.uid });

    req.firebaseUser = decodedToken;
    req.user = user || null;

    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export default verifyToken;