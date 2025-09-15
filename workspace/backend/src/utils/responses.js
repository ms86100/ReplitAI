const createSuccessResponse = (data, message = null) => {
  return {
    success: true,
    data,
    ...(message && { message })
  };
};

const createErrorResponse = (error, code = 'ERROR', statusCode = 400) => {
  return {
    success: false,
    error,
    code,
    statusCode
  };
};

const sendResponse = (res, response) => {
  const statusCode = response.statusCode || (response.success ? 200 : 400);
  delete response.statusCode;
  res.status(statusCode).json(response);
};

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  sendResponse
};