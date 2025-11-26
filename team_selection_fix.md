# Team Selection API Fix for App.tsx

Replace lines 156-176 in `src/App.tsx` with the following code:

```typescript
// Set team for user
const setTeamForUser = async (teamId: number) => {
    try {
        const res = await apiFetch(`/api/user/team`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team_id: teamId }),
        });
        if (!res.ok) {
            alert('Failed to update user team.');
            return;
        }
        const data = await res.json();
        auth.setAuthUser(data.user || data);
        localStorage.setItem('ett_user', JSON.stringify(data.user || data));
        localStorage.setItem('ett_team', String(teamId));
        alert('Team updated successfully!');
    } catch (err) {
        console.error('Error updating team', err);
        alert('Error updating team. Check console.');
    }
};
```

This fix changes:
1. API endpoint from `/api/users/${id}` to `/api/user/team` (current user's team)
2. Method from PATCH to PUT
3. Adds `ett_team` to localStorage for persistence
