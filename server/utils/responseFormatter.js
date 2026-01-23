/**
 * API Response Formatter
 * 
 * Provides consistent response formats for all API endpoints
 */
class ResponseFormatter {
    /**
     * Format successful response
     * @param {*} data - Response data
     * @param {string} message - Optional success message
     * @param {object} meta - Optional metadata
     */
    success(data, message = null, meta = {}) {
        const response = {
            success: true,
            timestamp: new Date().toISOString()
        };

        if (message) response.message = message;
        if (data !== undefined) response.data = data;
        if (Object.keys(meta).length > 0) response.meta = meta;

        return response;
    }

    /**
     * Format error response
     * @param {string} message - Error message
     * @param {array} errors - Validation errors
     * @param {number} statusCode - HTTP status code
     */
    error(message, errors = null, statusCode = 500) {
        const response = {
            success: false,
            message,
            statusCode,
            timestamp: new Date().toISOString()
        };

        if (errors) response.errors = errors;

        return response;
    }

    /**
     * Format paginated response (offset-based)
     * @param {array} items - Array of items
     * @param {object} pagination - Pagination info
     */
    paginated(items, pagination) {
        const { page, limit, total } = pagination;
        const pages = Math.ceil(total / limit);

        return {
            success: true,
            data: items,
            pagination: {
                page,
                limit,
                total,
                pages,
                hasNext: page < pages,
                hasPrev: page > 1
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format cursor-based paginated response
     * @param {array} items - Array of items
     * @param {object} cursor - Cursor pagination info
     */
    cursorPaginated(items, cursor) {
        return {
            success: true,
            data: items,
            pagination: {
                nextCursor: cursor.next,
                hasMore: cursor.hasMore
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format list response (no pagination)
     * @param {array} items - Array of items
     * @param {number} count - Total count
     */
    list(items, count = null) {
        return {
            success: true,
            data: items,
            count: count !== null ? count : items.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format single item response
     * @param {object} item - Single item
     * @param {string} message - Optional message
     */
    item(item, message = null) {
        return this.success(item, message);
    }

    /**
     * Format created response (201)
     * @param {object} item - Created item
     * @param {string} message - Success message
     */
    created(item, message = 'Resource created successfully') {
        return this.success(item, message);
    }

    /**
     * Format updated response
     * @param {object} item - Updated item
     * @param {string} message - Success message
     */
    updated(item, message = 'Resource updated successfully') {
        return this.success(item, message);
    }

    /**
     * Format deleted response
     * @param {string} message - Success message
     */
    deleted(message = 'Resource deleted successfully') {
        return this.success(null, message);
    }

    /**
     * Format validation error response
     * @param {array} errors - Array of validation errors
     */
    validationError(errors) {
        return this.error('Validation failed', errors, 400);
    }

    /**
     * Format not found response
     * @param {string} resource - Resource name
     */
    notFound(resource = 'Resource') {
        return this.error(`${resource} not found`, null, 404);
    }

    /**
     * Format unauthorized response
     */
    unauthorized(message = 'Unauthorized access') {
        return this.error(message, null, 401);
    }

    /**
     * Format forbidden response
     */
    forbidden(message = 'Access forbidden') {
        return this.error(message, null, 403);
    }
}

module.exports = new ResponseFormatter();
