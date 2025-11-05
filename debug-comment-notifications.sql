-- Test if the notification was created for the comment
SELECT 
    n.*,
    u.username as recipient_username,
    u.fullName as recipient_fullname,
    a.title as assignment_title
FROM notifications n
JOIN users u ON n.user_id = u.id
LEFT JOIN assignments a ON n.assignment_id = a.id
WHERE n.type = 'comment'
ORDER BY n.created_at DESC
LIMIT 10;

-- Check assignment_members for assignment ID 88
SELECT 
    am.*,
    u.username,
    u.fullName,
    u.role
FROM assignment_members am
JOIN users u ON am.user_id = u.id
WHERE am.assignment_id = 88;

-- Check all comments on assignment 88
SELECT 
    ac.*,
    u.username,
    u.fullName,
    u.role
FROM assignment_comments ac
JOIN users u ON ac.user_id = u.id
WHERE ac.assignment_id = 88
ORDER BY ac.created_at DESC;

-- Check if Bryan User is in assignment_members
SELECT * FROM users WHERE username LIKE '%ryan%';
