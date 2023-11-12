const express = require('express');
const multer = require('multer');
const ejs = require('ejs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const httpsoptions = {
     key: fs.readFileSync('./cert/privkey.pem'),
     cert: fs.readFileSync('./cert/fullchain.pem'),
     ca: fs.readFileSync('./cert/chain.pem')
}

const storage = multer.diskStorage({
  destination: './uploads',
  filename: function (req, file, cb) {
    if (file.fieldname === 'xmlFile') {
      cb(null, path.parse(file.originalname).name + '-' + file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    } else if (file.fieldname === 'imageFile') {
      cb(null, path.parse(file.originalname).name + '-' + file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  }
});

const uploadMulter = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024, // 1MB
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/xml' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xml files or images are allowed'));
    }
  }
}).fields([
  { name: 'xmlFile', maxCount: 1 },
  { name: 'imageFile', maxCount: 1 }
]);

const app = express();
app.set('view engine', 'ejs');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Create SQLite database and table
const db = new sqlite3.Database('database.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run('CREATE TABLE IF NOT EXISTS xmlFiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, xmlFilePath TEXT, imageFilePath TEXT, votes INTEGER, reports INTEGER)');
  }
});

app.get('/', (req, res) => {
  db.all('SELECT * FROM xmlFiles ORDER BY votes DESC', (err, rows) => {
    if (err) {
      console.error(err.message);
    } else {
      res.render('index', {
        msg: null,
        xmlFiles: rows
      });
    }
  });
});


app.get('/blueprint/:xmlFilePath', (req, res) => {
  const xmlFilePath = req.params.xmlFilePath;
  db.get('SELECT * FROM xmlFiles WHERE xmlFilePath LIKE ?', [`%${xmlFilePath}%`], (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Failed to retrieve XML data' });
    } else {
      if (row) {
        res.render('blueprint', {
        xmlFiles: row
      });
      } else {
        res.status(404).json({ error: 'XML data not found' });
      }
    }
  });
});

const removeItem = (xmlFilePath, res) => {
	  db.get('SELECT * FROM xmlFiles WHERE xmlFilePath LIKE ?', [`%${xmlFilePath}%`], (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Failed to retrieve XML file' });
    } else {
      if (row) {
		  var result = '';
		  //remove xml
        var filePath = path.join(__dirname, row.xmlFilePath);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to remove XML file' });
          }
        });
		
		
		  //remove image
        var filePath = path.join(__dirname, row.imageFilePath);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Failed to remove XML file' });
          }
        });
		
		db.run('DELETE FROM xmlFiles WHERE xmlFilePath LIKE ?', [`%${xmlFilePath}%`], (err) => {
              if (err) {
                console.error(err.message);
                res.status(500).json({ error: 'Failed to remove XML file' });
              } else {				
				res.status(500).json({ error: 'XML file removed successfully' });
              }
            });
		
      } else {
        res.status(404).json({ error: 'XML file not found' });
      }
    }
  });
}

/*
	app.get('/remove/:xmlFilePath', (req, res) => {
	const xmlFilePath = req.params.xmlFilePath;
		removeItem(xmlFilePath, res);
	});
	app.get('/erase', (req, res) => {
	db.all('DROP TABLE xmlFiles', (err) => {
		if (err) {
		console.error(err.message);
		}else{
			res.json(200);
		}
	});
	});
*/

app.post('/upload', (req, res) => {
  uploadMulter(req, res, (err) => {
    if (err) {
      res.render('index', {
        msg: err
      });
    } else {
      if (req.files['xmlFile'] == undefined || req.files['imageFile'] == undefined) {
        res.render('index', {
          msg: 'Error: XML File or Image File not selected!'
        });
      } else {
        const xmlFile = {
          name: req.body.name,
          xmlFilePath: `/uploads/${req.files['xmlFile'][0].filename}`,
          imageFilePath: `/uploads/${req.files['imageFile'][0].filename}`,
          votes: 0,
		  reports: 0
        };
        db.run('INSERT INTO xmlFiles (name, xmlFilePath, imageFilePath, votes, reports) VALUES (?, ?, ?, ?, ?)', [xmlFile.name, xmlFile.xmlFilePath, xmlFile.imageFilePath, xmlFile.votes, xmlFile.reports], (err) => {
          if (err) {
            console.error(err.message);
          } else {            
			res.redirect('/blueprint/'+xmlFile.xmlFilePath.replace('/uploads/',''));
          }
        });
      }
    }
  });
});

app.post('/vote', (req, res) => {
  const selectedXmlFile = req.body.xmlFilePath;
  db.run('UPDATE xmlFiles SET votes = votes + 1 WHERE xmlFilePath = ?', [selectedXmlFile], (err) => {
    if (err) {
      console.error(err.message);
    }
    res.redirect('/');
  });
});

app.post('/report', (req, res) => {
  const selectedXmlFile = req.body.xmlFilePath;
  db.run('UPDATE xmlFiles SET reports = reports + 1 WHERE xmlFilePath = ?', [selectedXmlFile], (err) => {
    if (err) {
      console.error(err.message);
    }
    res.redirect('/');
  });
});


const port = 80;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

//var server = https.createServer(httpsoptions, app);
//server.listen(443);
//sudo node server.js
