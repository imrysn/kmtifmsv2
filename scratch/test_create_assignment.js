const assignmentService = require('../server/services/assignmentService');
const { closePool } = require('../database/config');

async function test() {
  const mockUser = {
    id: 4,
    username: 'team.leader',
    team: 'IT Dept'
  };

  const mockData = {
    title: 'Test Scratch Assignment',
    description: 'Creating task from scratch script',
    due_date: '2026-05-30 00:00:00',
    file_type_required: 'any',
    assigned_to: 'all'
  };

  console.log('Calling createAssignment...');
  try {
    const result = await assignmentService.createAssignment(mockData, [], mockUser);
    console.log('Result:', result);
    
    // Wait 2 seconds for setImmediate to execute
    console.log('Waiting for setImmediate folder provisioning...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { query } = require('../server/config/database');
    const rows = await query('SELECT * FROM assignments WHERE id = ?', [result.assignmentId]);
    console.log('Inserted Assignment Row:', rows);
    
    await closePool();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await closePool();
    process.exit(1);
  }
}

test();
