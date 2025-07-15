import QRCode from "qrcode";
import crypto from "crypto";
import { apiResponse } from "../utils/helper.js";
import { db } from "../utils/db.js";

// Generate unique QR code for Gurudwara
// Generate unique QR code for Gurudwara
export async function generateGurudwaraQR(gurudwaraId) {
  try {
    // Create unique identifier for the QR code
    const timestamp = Date.now();
    const uniqueData = `gurudwara_${gurudwaraId}_${timestamp}`;
    const qrHash = crypto
      .createHash("sha256")
      .update(uniqueData)
      .digest("hex")
      .substring(0, 16);

    // QR code data structure - Fixed: changed 'type' to 'visit' to match scan function
    const qrData = {
      visit: "gurudwara_visit", // Fixed: changed from 'type' to 'visit' and fixed typo
      id: gurudwaraId,
      code: qrHash,
      timestamp: timestamp,
    };

    // Generate QR code as data URL
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Save QR code data URL to database
    await db.query("UPDATE gurudwaras SET qr_code_url = ? WHERE id = ?", [
      qrCodeDataURL,
      gurudwaraId,
    ]);

    return {
      qrCodeImage: qrCodeDataURL,
      qrCodeData: qrHash,
      qrData: JSON.stringify(qrData), // Add raw QR data for testing
      gurudwaraId: gurudwaraId,
    };
  } catch (error) {
    throw new Error(`QR generation failed: ${error.message}`);
  }
}

// // API endpoint for generating QR
// app.post("/admin/gurudwara/:id/generate-qr", async (req, res) => {
//   try {
//     const gurudwaraId = req.params.id;

//     // Check if gurudwara exists
//     const gurudwara = await db.query("SELECT * FROM gurudwaras WHERE id = ?", [
//       gurudwaraId,
//     ]);

//     if (gurudwara.length === 0) {
//       return res.status(404).json({ error: "Gurudwara not found" });
//     }

//     const qrResult = await generateGurudwaraQR(gurudwaraId);

//     res.json({
//       success: true,
//       message: "QR code generated successfully",
//       data: qrResult,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });

// // API to get existing QR code
// app.get("/admin/gurudwara/:id/qr", async (req, res) => {
//   try {
//     const gurudwaraId = req.params.id;

//     const result = await db.query(
//       "SELECT name, qr_code_url FROM gurudwaras WHERE id = ?",
//       [gurudwaraId]
//     );

//     if (result.length === 0) {
//       return res.status(404).json({ error: "Gurudwara not found" });
//     }

//     res.json({
//       success: true,
//       data: {
//         name: result[0].name,
//         qrCodeUrl: result[0].qr_code_url,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });
