import React, { useState } from 'react';
import { getDisplayName } from '../../utils/nameUtils';

export interface GroupManagerModalProps {
  mode: 'create' | 'edit';
  initialGroupName?: string;
  initialMembers?: string[];
  usersList: any[];
  currentUsername?: string;
  onSubmit: (name: string, members: string[]) => Promise<void> | void;
  onClose: () => void;
}

export function GroupManagerModal({
  mode,
  initialGroupName = '',
  initialMembers = [],
  usersList,
  currentUsername,
  onSubmit,
  onClose
}: GroupManagerModalProps) {
  const [groupName, setGroupName] = useState(initialGroupName);
  const [members, setMembers] = useState<string[]>(initialMembers);

  const toggleMember = (username: string) => {
    setMembers(prev => prev.includes(username) ? prev.filter(m => m !== username) : [...prev, username]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    onSubmit(groupName.trim(), members);
  };

  return (
    <div className="group-modal-backdrop">
      <form className="group-modal-content" onSubmit={handleSubmit}>
        <div className="group-modal-header">
          <h4>{mode === 'create' ? 'Create Group Chat' : 'Edit Group Members'}</h4>
          <button type="button" className="group-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="group-modal-body">
          <div className="form-group">
            <label>Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              required
            />
          </div>
          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>Select Members</label>
            <div className="members-checkbox-list">
              {usersList
                .filter(u => u.username !== currentUsername)
                .map(u => (
                  <label key={u.id || u.username} className="member-checkbox-row">
                    <input
                      type="checkbox"
                      checked={members.includes(u.username)}
                      onChange={() => toggleMember(u.username)}
                    />
                    <span>{u.fullName || getDisplayName(u.username) || u.username}</span>
                  </label>
                ))
              }
            </div>
          </div>
        </div>
        <div className="group-modal-footer">
          <button type="button" className="group-btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="group-btn-primary">
            {mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
