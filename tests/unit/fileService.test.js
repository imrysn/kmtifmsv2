/**
 * File Service Tests
 * 
 * Tests for file service business logic
 */

const fileService = require('../../server/services/fileService');
const fileRepository = require('../../server/repositories/fileRepository');
const { NotFoundError, ValidationError } = require('../../server/middleware/errorHandler');

// Mock the repository
jest.mock('../../server/repositories/fileRepository');
jest.mock('../../server/utils/logger');
jest.mock('../../server/config/database', () => ({
    db: {
        run: jest.fn()
    }
}));

describe('File Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('uploadFile', () => {
        test('should create file record with correct data', async () => {
            const fileData = {
                filename: 'test.pdf',
                original_name: 'test.pdf',
                file_path: '/uploads/test.pdf',
                file_size: 1024,
                file_type: 'pdf',
                mime_type: 'application/pdf',
                description: 'Test file'
            };

            const user = {
                id: 1,
                username: 'testuser',
                team: 'Engineering',
                role: 'USER'
            };

            const mockFile = { id: 123, ...fileData, user_id: 1 };

            fileRepository.create.mockResolvedValue(123);
            fileRepository.findById.mockResolvedValue(mockFile);

            const result = await fileService.uploadFile(fileData, user);

            expect(fileRepository.create).toHaveBeenCalledWith({
                ...fileData,
                user_id: user.id,
                username: user.username,
                user_team: user.team,
                status: 'uploaded',
                current_stage: 'pending_team_leader'
            });
            expect(result).toEqual(mockFile);
        });
    });

    describe('getFileById', () => {
        test('should return file if user owns it', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 1,
                user_team: 'Engineering'
            };

            const user = {
                id: 1,
                role: 'USER',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            const result = await fileService.getFileById(1, user);

            expect(result).toEqual(mockFile);
        });

        test('should throw NotFoundError if file does not exist', async () => {
            fileRepository.findById.mockResolvedValue(null);

            const user = { id: 1, role: 'USER', team: 'Engineering' };

            await expect(fileService.getFileById(999, user))
                .rejects
                .toThrow(NotFoundError);
        });

        test('should throw ValidationError if user cannot view file', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 2,
                user_team: 'Marketing'
            };

            const user = {
                id: 1,
                role: 'USER',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            await expect(fileService.getFileById(1, user))
                .rejects
                .toThrow(ValidationError);
        });

        test('should allow admin to view any file', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 2,
                user_team: 'Marketing'
            };

            const admin = {
                id: 1,
                role: 'ADMIN',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            const result = await fileService.getFileById(1, admin);

            expect(result).toEqual(mockFile);
        });

        test('should allow team leader to view team files', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 2,
                user_team: 'Engineering'
            };

            const teamLeader = {
                id: 1,
                role: 'TEAM_LEADER',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            const result = await fileService.getFileById(1, teamLeader);

            expect(result).toEqual(mockFile);
        });
    });

    describe('approveByTeamLeader', () => {
        test('should approve file and update status', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_team: 'Engineering',
                current_stage: 'pending_team_leader'
            };

            const teamLeader = {
                id: 2,
                username: 'teamlead',
                role: 'TEAM_LEADER',
                team: 'Engineering'
            };

            const updatedFile = { ...mockFile, status: 'team_leader_approved' };

            fileRepository.findById.mockResolvedValueOnce(mockFile);
            fileRepository.updateStatus.mockResolvedValue(true);
            fileRepository.findById.mockResolvedValueOnce(updatedFile);

            const result = await fileService.approveByTeamLeader(1, teamLeader, 'Looks good');

            expect(fileRepository.updateStatus).toHaveBeenCalledWith(1, {
                status: 'team_leader_approved',
                current_stage: 'pending_admin',
                team_leader_id: teamLeader.id,
                team_leader_username: teamLeader.username,
                team_leader_comments: 'Looks good'
            });
            expect(result.status).toBe('team_leader_approved');
        });

        test('should throw error if team leader not from same team', async () => {
            const mockFile = {
                id: 1,
                user_team: 'Marketing',
                current_stage: 'pending_team_leader'
            };

            const teamLeader = {
                id: 2,
                team: 'Engineering',
                role: 'TEAM_LEADER'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            await expect(fileService.approveByTeamLeader(1, teamLeader))
                .rejects
                .toThrow(ValidationError);
        });

        test('should throw error if file not in correct stage', async () => {
            const mockFile = {
                id: 1,
                user_team: 'Engineering',
                current_stage: 'approved'
            };

            const teamLeader = {
                id: 2,
                team: 'Engineering',
                role: 'TEAM_LEADER'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            await expect(fileService.approveByTeamLeader(1, teamLeader))
                .rejects
                .toThrow(ValidationError);
        });
    });

    describe('deleteFile', () => {
        test('should allow user to delete own file', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 1,
                file_path: '/uploads/test.pdf'
            };

            const user = {
                id: 1,
                username: 'testuser',
                role: 'USER',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);
            fileRepository.deleteById.mockResolvedValue(true);

            const result = await fileService.deleteFile(1, user);

            expect(fileRepository.deleteById).toHaveBeenCalledWith(1);
            expect(result).toBe(true);
        });

        test('should allow admin to delete any file', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 2,
                file_path: '/uploads/test.pdf'
            };

            const admin = {
                id: 1,
                username: 'admin',
                role: 'ADMIN',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);
            fileRepository.deleteById.mockResolvedValue(true);

            const result = await fileService.deleteFile(1, admin);

            expect(result).toBe(true);
        });

        test('should not allow user to delete others files', async () => {
            const mockFile = {
                id: 1,
                filename: 'test.pdf',
                user_id: 2,
                file_path: '/uploads/test.pdf'
            };

            const user = {
                id: 1,
                username: 'testuser',
                role: 'USER',
                team: 'Engineering'
            };

            fileRepository.findById.mockResolvedValue(mockFile);

            await expect(fileService.deleteFile(1, user))
                .rejects
                .toThrow(ValidationError);
        });
    });

    describe('getFileStats', () => {
        test('should return correct statistics', async () => {
            fileRepository.count
                .mockResolvedValueOnce(100) // total
                .mockResolvedValueOnce(30)  // uploaded
                .mockResolvedValueOnce(50)  // approved
                .mockResolvedValueOnce(20); // rejected

            const stats = await fileService.getFileStats({ team: 'Engineering' });

            expect(stats).toEqual({
                total: 100,
                uploaded: 30,
                approved: 50,
                rejected: 20,
                pending: 30
            });
        });
    });
});
