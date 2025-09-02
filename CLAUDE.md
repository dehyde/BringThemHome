# Claude Code Development Notes

## Debug Logging Best Practices

### Use Unique Tags for Focused Debugging

When debugging specific issues, use unique, searchable tags to avoid console noise:

```javascript
// ❌ Generic debug logs (hard to filter)
console.log(`[DEBUG] Processing hostage: ${name}`);

// ✅ Specific debug tags (easy to search/filter)
console.log(`[EDEN_DEBUG] Final lane: ${lane}`);
console.log(`[SORT_BUG] Unexpected sort order for: ${name}`);
console.log(`[TRANSITION_FIX] Path generation: ${path}`);
```

### Guidelines:
- **One unique tag per debugging session** - e.g., `[EDEN_DEBUG]` for tracking עדן ירושלמי
- **Limit tagged logs to essential info only** - max 3-5 logs per debug session
- **Remove debug tags after issue is resolved** - don't leave them in production
- **Use descriptive tag names** that relate to the specific issue being debugged

### Current Active Debug Tags:
- `[EDEN_DEBUG]` - Tracking עדן ירושלמי sorting issue (temporary)

## Project Architecture Notes

### Lane Management System
- Each hostage has a transition path through multiple lanes
- Sorting is applied within each lane based on transition type and dates
- Position assignment must respect the sorted order from lane manager

### Key Files:
- `data-processor.js` - Lane assignment and transition path generation
- `lane-manager.js` - Within-lane sorting and position assignment
- `timeline-core.js` - Visual rendering and coordinate system

## Known Issues and Fixes

### Sorting Override Bug (Fixed)
**Issue**: Position assignment was re-sorting hostages by eventOrder, overriding lane-specific sorting
**Fix**: Removed re-sorting in `assignLanePositions()` method
**Files**: `lane-manager.js:357-359`