module.exports = (err, req, res, next) => {
  console.error(err);
  // B7: map Mongoose ValidationError to 400 instead of 500
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map(v => v.message);
    return res.status(400).json({ message: messages.join(". ") || "Validation failed." });
  }
  const status = err.statusCode || 500;
  res.status(status).json({
    message: status === 500 ? "Something went wrong on the server." : err.message
  });
};