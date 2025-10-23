# Google Classroom-Style Assignment System for Team Leaders

## Overview
Team Leaders will function like advisers/teachers who can:
- Create file assignments for team members
- Set due dates for assignments
- Assign to all members or specific individuals
- Track submissions and see who submitted/who hasn't
- Review submitted files

## Database Schema Changes Needed

### New Table: assignments
```sql
CREATE TABLE assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  team_leader_id INTEGER NOT NULL,
  team_leader_username VARCHAR(100),
  team VARCHAR(50) NOT NULL,
  due_date DATETIME,
  file_type_required VARCHAR(100),
  assigned_to VARCHAR(10) DEFAULT 'all',
  max_file_size INTEGER,
  status VARCHAR(50) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_leader_id) REFERENCES users(id)
);
```

### New Table: assignment_members
```sql
CREATE TABLE assignment_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  username VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  submitted_at DATETIME,
  file_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);
```

### Modify files table
```sql
ALTER TABLE files ADD COLUMN assignment_id INTEGER;
ALTER TABLE files ADD COLUMN submitted_for_assignment BOOLEAN DEFAULT 0;
```

## Implementation Steps

### Phase 1: Database Setup
1. Create migration script
2. Add new tables
3. Update files table

### Phase 2: Backend APIs
1. Assignment CRUD operations
2. Submission tracking
3. Member management

### Phase 3: Frontend UI
1. Team Leader: Assignments tab
2. Team Leader: Create/Edit assignment modal
3. Team Leader: Submission tracking view
4. User: Assignments view
5. User: File upload for assignment

Would you like me to start implementing this system?
