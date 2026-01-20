/**
 * Validation Schema Tests
 * 
 * Tests for Joi validation schemas to ensure proper input validation
 */

const { schemas } = require('../../server/middleware/validation');

describe('Validation Schemas', () => {
    describe('createUser schema', () => {
        test('should accept valid user data', () => {
            const validData = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
                password: 'password123',
                role: 'USER',
                team: 'Engineering'
            };

            const { error } = schemas.createUser.validate(validData);
            expect(error).toBeUndefined();
        });

        test('should reject password less than 8 characters', () => {
            const invalidData = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
                password: 'short',
                role: 'USER'
            };

            const { error } = schemas.createUser.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('8 characters');
        });

        test('should reject password without letters', () => {
            const invalidData = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
                password: '12345678',
                role: 'USER'
            };

            const { error } = schemas.createUser.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('letters and numbers');
        });

        test('should reject password without numbers', () => {
            const invalidData = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
                password: 'password',
                role: 'USER'
            };

            const { error } = schemas.createUser.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('letters and numbers');
        });

        test('should reject invalid email', () => {
            const invalidData = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'invalid-email',
                password: 'password123',
                role: 'USER'
            };

            const { error } = schemas.createUser.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('valid email');
        });

        test('should reject username less than 3 characters', () => {
            const invalidData = {
                fullName: 'John Doe',
                username: 'ab',
                email: 'john@example.com',
                password: 'password123',
                role: 'USER'
            };

            const { error } = schemas.createUser.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('3 characters');
        });

        test('should reject non-alphanumeric username', () => {
            const invalidData = {
                fullName: 'John Doe',
                username: 'john@doe',
                email: 'john@example.com',
                password: 'password123',
                role: 'USER'
            };

            const { error } = schemas.createUser.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('letters and numbers');
        });

        test('should use default role if not provided', () => {
            const data = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
                password: 'password123'
            };

            const { error, value } = schemas.createUser.validate(data);
            expect(error).toBeUndefined();
            expect(value.role).toBe('USER');
        });

        test('should use default team if not provided', () => {
            const data = {
                fullName: 'John Doe',
                username: 'johndoe',
                email: 'john@example.com',
                password: 'password123'
            };

            const { error, value } = schemas.createUser.validate(data);
            expect(error).toBeUndefined();
            expect(value.team).toBe('General');
        });
    });

    describe('login schema', () => {
        test('should accept valid login data', () => {
            const validData = {
                email: 'john@example.com',
                password: 'password123'
            };

            const { error } = schemas.login.validate(validData);
            expect(error).toBeUndefined();
        });

        test('should reject missing email', () => {
            const invalidData = {
                password: 'password123'
            };

            const { error } = schemas.login.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('required');
        });

        test('should reject missing password', () => {
            const invalidData = {
                email: 'john@example.com'
            };

            const { error } = schemas.login.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('required');
        });

        test('should use default loginType if not provided', () => {
            const data = {
                email: 'john@example.com',
                password: 'password123'
            };

            const { error, value } = schemas.login.validate(data);
            expect(error).toBeUndefined();
            expect(value.loginType).toBe('user');
        });
    });

    describe('resetPassword schema', () => {
        test('should accept valid password', () => {
            const validData = {
                password: 'newpassword123'
            };

            const { error } = schemas.resetPassword.validate(validData);
            expect(error).toBeUndefined();
        });

        test('should reject weak password', () => {
            const invalidData = {
                password: 'weak'
            };

            const { error } = schemas.resetPassword.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('8 characters');
        });

        test('should enforce same password rules as createUser', () => {
            const invalidData = {
                password: 'noNumbers'
            };

            const { error } = schemas.resetPassword.validate(invalidData);
            expect(error).toBeDefined();
            expect(error.details[0].message).toContain('letters and numbers');
        });
    });
});
