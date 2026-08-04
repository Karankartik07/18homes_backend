import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const rawKey = process.env.RAZORPAY_KEY_ID || "rzp_test_TAwig7RAJNiuHo";
const rawSecret = process.env.RAZORPAY_KEY_SECRET || "xXRO5M464qVSdjcKpW2C4Gw2";

console.log("Raw Key:", JSON.stringify(rawKey), "Length:", rawKey.length);
console.log("Raw Secret:", JSON.stringify(rawSecret), "Length:", rawSecret.length);

// Print character codes to inspect carriage returns
console.log("Key Char Codes:", Array.from(rawKey).map(c => c.charCodeAt(0)));
console.log("Secret Char Codes:", Array.from(rawSecret).map(c => c.charCodeAt(0)));

const key_id = rawKey.trim();
const key_secret = rawSecret.trim();

const rzp = new Razorpay({
  key_id,
  key_secret,
});

async function test() {
  try {
    const order = await rzp.orders.create({
      amount: 100,
      currency: "INR",
      receipt: "receipt_test_" + Date.now(),
    });
    console.log("✅ Success! Razorpay Order Created with Trimmed Keys:", order);
  } catch (error) {
    console.error("❌ Razorpay Order Creation Failed even with Trimmed Keys!");
    console.error("Error details:", error);
  }
}

test();
