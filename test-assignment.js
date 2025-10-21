const fetch = require('node-fetch');

async function testAssignmentCreation() {
  try {
    console.log('🚀 Testing assignment creation...');

    const response = await fetch('http://localhost:3001/api/assignments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Test Assignment',
        description: 'Test assignment creation',
        team: 'General',
        teamLeaderId: 1,
        teamLeaderUsername: 'admin',
        assignedTo: 'all'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('✅ Assignment creation successful!');
      console.log('Assignment ID:', data.assignmentId);
      console.log('Members assigned:', data.membersAssigned);
    } else {
      console.log('❌ Assignment creation failed:', data.message);
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Error testing assignment creation:', error.message);
  }
}

testAssignmentCreation();
