const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');


// app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, './')));
// Create a transporter using Gmail service
const transporter = nodemailer.createTransport({
  service: 'gmail',
  secure: true,
  port: 465,
  auth: {
    user: 'architsavaliya175@gmail.com',
    pass: 'ybsp kxzw fbig gcab'   }
});

app.post('/submit', async (req, res) => {
  const { name, email, phone, country, message,total } = req.body;
    console.log(req.body);
  const totalDonation = req.body.total;


    // Send thank you email to donor
    const mailOptions = {
        from: 'architsavaliya175@gmail.com',
      to: 'architsavaliya175@gmail.com',
      subject: "Thank You for Your Donation",
      html: `
        <h2>Thank You for Your Donation!</h2>
        <p>Dear ${name},</p>
        <p>We greatly appreciate your generous donation of $${totalDonation} to our tree planting initiative. Your contribution will help us make the world a greener place.</p>
        <p>Thank you for your support!</p>
        <p>Best regards,</p>
        <p>The Plant Donation Team</p>
      `
    };


    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          res.status(500).send('Error sending email');
        } else {
          console.log('Email sent: ' + info.response);
          res.status(200).send('Receipt email sent');
         
        }
      });
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, './', 'plantree.html'));
      });
      
      const PORT = process.env.PORT || 3002;
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
      
