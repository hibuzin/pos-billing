const successResponse = (res, data = {}, message = "Success", status = 200) => {
    return res.status(status).json({
        success: true,
        data,
        message,
        error: null
    });
};

const errorResponse = (res, message = "Error", status = 500) => {
    return res.status(status).json({
        success: false,
        data: null,
        message,
        error: message
    });
};

module.exports = {
    successResponse,
    errorResponse
};