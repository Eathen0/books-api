// Importing Modules
const express = require("express");
const app = express();
const http = require("http");

const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const upload = multer({
	limits: { fileSize: 5000000 },
	storage: multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, path.join(__dirname, "/tmp"));
		},
		filename: (req, file, cb) => {
			const uniqueSuffix =
				Date.now() + "-" + Math.round(Math.random() * 1e5);
			const fileFormat = file.originalname.slice(
				file.originalname.indexOf(".", -1)
			);
			cb(null, file.fieldname + "-" + uniqueSuffix + fileFormat);
		},
	}),
});

// database
const host = process.env.DB_HOST || 'localhost'
const database = process.env.DB_NAME || 'book_shop'
const user = process.env.DB_USER || 'root'
const password = process.env.DB_PASSWORD || ''

const mysql = require("mysql");
const DB = mysql.createConnection({host, user, password, database})
DB.connect((err) => {
	console.log(err || "connected with mysql");
});

// Set a Port
// const PORT = process.env.PORT || 9000;

app.use(
	express.static("./tmp", {
		index: false,
		redirect: false,
	})
);
app.use(bodyParser.json());

// API documentation
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, '/pages/home.html'))
	// res.status(200).json({ message: "success" });
});

// Some EndPoint
app.route("/books")
	.get((req, res) => {
		DB.query("SELECT * FROM `books`", (err, row, field) => {
			if (err) {
				res.status(400).json({
					result: null,
					message: "request falied",
				});
			} else if (Array.isArray(row) & (row.length != 0)) {
				res.status(200).json({
					result: [...row],
				});
			} else {
				res.status(404).json({
					result: null,
					message: "data is empty",
				});
			}
		});
	})
	.post((req, res) => {
		upload.single("cover")(req, res, (err) => {
			if (err instanceof multer.MulterError) {
				res.status(400).json({
					result: null,
					message: err.message,
				});
			} else if (err) {
				res.status(502).json({
					result: null,
					message: err.message,
				});
			} else {
				try {
					DB.query(`INSERT INTO \`books\` (\`id\`, \`title\`, \`synopsis\`, \`cover\`, \`like\`, \`disLike\`) 
                  VALUES (NULL, ${mysql.escape(req.body.title)}, ${mysql.escape(
							req.body.synopsis
						)}, ${mysql.escape(
							path.join(__dirname, `/tmp/${req.file.filename}`)
						)}, 0, 0)`,
						(err, row, filed) => {
							if (err) {
								console.log(err);
								res.status(400).json({
									result: false,
									message: "falied adding new book",
								});
							} else {
								res.status(200).json({
									result: {...req.body, cover: path.join(__dirname, "/tmp/" + req.file.filename),},
									message: "success adding new book",
								});
							}
						}
					);
				} catch {
					res.status(202).json({
						result: null,
						message: "body request is invalid",
					});
				}
			}
		});
	});

app.route("/book/:id")
	.get((request, response) => {
		DB.query(
			`SELECT * FROM \`books\` WHERE id=${mysql.escape(request.params.id)}`,
			(err, row, filed) => {
				if (err) {
					response.status(400).json({
						result: null,
						message: "request falied",
					});
				} else if (Array.isArray(row) & (row.length != 0)) {
					response.status(200).json({
						result: [...row],
					});
				} else {
					response.status(404).json({
						result: null,
						message: `book id ${request.params.id} not found`,
					});
				}
			}
		);
	})
	.patch((req, res) => {})
	.delete((req, res) => {
		DB.query(
			`SELECT * FROM \`books\` WHERE id=${mysql.escape(req.params.id)}`,
			(err, row, filed) => {
				if (err) {
					res.status(400).json({
						result: null,
						message: "request falied",
					});
				} else if (Array.isArray(row) & (row.length != 0)) {
					fs.unlink(path.normalize({ ...row["0"] }.cover), (err) => {
						if (err) {
							res.status(502).json({
								result: null,
								message: "falied to delete book cover image",
							});
						} else {
							DB.query(
								`DELETE FROM \`books\` WHERE id=${mysql.escape(
									req.params.id
								)}`,
								(err) => {
									if (!err) {
										res.status(200).json({
											result: true,
											message: `success deleted book with id '${req.params.id}'`,
										});
									}
								}
							);
						}
					});
				} else {
					res.status(404).json({
						result: null,
						message: `book id ${req.params.id} not found`,
					});
				}
			}
		);
	});

// Error EndPoint handling
app.get("/*", (request, response) => {
	response.sendFile(path.join(__dirname, "pages/error.html"));
});

// Running a server
// app.listen(PORT, () => {
//    console.log(`Server is running in http://localhost:${PORT}`)
// })

var port = normalizePort(process.env.PORT || "9000");
app.set("port", port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", () => {
   console.log('listening');
});

function onError(error) {
	if (error.syscall !== "listen") {
		throw error;
	}

	var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case "EACCES":
			console.error(bind + " requires elevated privileges");
			process.exit(1);
			break;
		case "EADDRINUSE":
			console.error(bind + " is already in use");
			process.exit(1);
			break;
		default:
			throw error;
	}
}

function normalizePort(val) {
	var port = parseInt(val, 10); // convert the value to an integer

	if (isNaN(port)) {
		// if the value is not a number, it could be a named pipe or a socket
		return val;
	}

	if (port >= 0) {
		// if the value is a positive number, it is a valid port
		return port;
	}

	return false; // otherwise, the value is invalid
}
