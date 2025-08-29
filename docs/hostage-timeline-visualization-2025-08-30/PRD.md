# Product Requirements Document: Hostage Timeline Visualization

## 1. Overview

### 1.1 Purpose
Create a comprehensive timeline visualization showing the journey of every hostage from the October 7th incident through their current status, using a swimlane-based approach that clearly shows state transitions over time.

### 1.2 User Goals
- **Primary**: Understand the impact of military operation and of delay on the surviavability of hostages compared to a deal
- *Secondary***: Understand the chronological progression of hostage situations
- **Tertiary**: Identify patterns in timing and circumstances

## 2. Data Requirements

### 2.1 Input Data Source
- **Primary File**: `hostages-from-kan.csv`
- **Required Fields**:
  - Name (Hebrew)
  - Initial status on October 7th (living/deceased)
  - Release date (if applicable)
  - Release method (Negotiations, Military extraction, Hamas-spontanious)
  - Death date (if applicable) or range-date of death
  - Death reason (Hamas execution unprovoked, Hamas execution as response to IDF progress, IDF accidental, Sanitary/health, unknown, any other)
  - Age when kidnapped
  - Photo URL
  - Direct URLs for all data sources

### 2.2 Data Processing Requirements
- **Date Validation**: All dates must be validated against valid date formats
- **Status Reconciliation**: Handle cases where release dates and status fields conflict
- **Missing Data Handling**: Provide default values for missing release dates when status indicates release

## 3. Visual Layout Requirements

### 3.1 Overall Geometry
- **Orientation**: Right-to-left (RTL) timeline flow
- **Dimensions**: Responsive width, full height
- **Timeline Direction**: Time flows from right (October 7, 2023) to left (present)

### 3.2 Swimlane Structure
    - Height of every division and subdivisions = aggregated height of all lines * their stroke width+all gaps between lines + internal padding of the division
#### 3.2.1 Major Divisions
- **Released Section**: 
  - Position: Top of visualization
  
- **Kidnapped Section**: 
  - Position: Bottom of visualization

#### 3.2.2 Released Section Subdivisions
- **Military Rescue Lane**:
  - Label: "חולצו במבצע" (Hebrew)
  - For hostages rescued by military operations
  
- **Deal Release Lane**: 15-55% (40% height)
  - Label: "שוחררו בעסקה" (Hebrew)
  - For hostages released through negotiations/deals

#### 3.2.3 Kidnapped Section Subdivisions
- **Living Kidnapped Lane**:
  - Label: "חטופים חיים" (Hebrew)
  - For hostages kidnapped alive on October 7th
  
- **Deceased Kidnapped Lane**: 
  - Label: "חטופים מתים" (Hebrew)
  - For hostages who died on October 7th, before or after

### 3.3 Lane Labeling Requirements
- **Position**: Right side of visualization
- **Language**: Hebrew (RTL support required)

## 4. Line Representation Requirements

### 4.1 Individual Hostage Lines
- **Line Type**: Individual lines (not aggregated flows)
- **Line Width**: 1px
- **Line Style**: 
  - Living hostages: Opaque lines
  - Deceased hostages: Semitransparent lines, same color
- **Line Caps**: Rounded (`stroke-linecap: round`)
- **Line Joins**: Rounded (`stroke-linejoin: round`)

### 4.2 Line Spacing Within Lanes
- **Spacing Method**: Fixed 4px spacing between lines
- **Overflow Handling**: Proportional compression if lines exceed lane height
- **Boundary Enforcement**: Lines must not exceed lane boundaries, lanes must change height according to the maximum number of lines that appear in the lane

### 4.3 Line Colors
- **Kidnapped Living**: Red (#ef4444)
- **Kidnapped Deceased**: Dark Red (#7f1d1d) with dashed pattern
- **Released Military**: Blue (#3b82f6)
- **Released Deal**: Green (#22c55e)

## 5. Timeline and Axis Requirements

### 5.1 Timeline Span
- **Start Date**: October 7, 2023
- **End Date**: Current date (dynamic)
- **Direction**: Right-to-left flow
- **Scale**: Linear time scale

### 5.2 Timeline Axis
- **Position**: Bottom of visualization
- **Markers**: Major date markers at regular intervals
- **Labels**: Hebrew date format
- **Color**: Neutral gray

## 6. State Transition Requirements

### 6.1 Initial State Assignment
- **Rule**: All hostages start in either "נחטפו חיים" or "נחטפו מתים" based on October 7th status
- **Date**: October 7, 2023 (rightmost position)

### 6.2 Death in Captivity Transitions
- **Trigger**: Death date exists AND no release date
- **Behavior**: 
  1. Horizontal line in source lane until death date
  2. Vertical transition to "נחטפו מתים" lane at death date
  3. Line continues in deceased lane until timeline end
- **Visual**: Change from solid to dashed line pattern

### 6.3 Release Transitions
- **Trigger**: Release date exists OR status = "Released"
- **Method Detection**:
  - Military: Circumstances contain "military" keywords
  - Deal: Circumstances contain "deal" keywords or default assumption
- **Behavior**:
  1. Horizontal line in source lane until release date
  2. Vertical transition to appropriate release lane
  3. Line continues in release lane until timeline end

### 6.4 Transition Geometry
- **Corner Style**: Rounded corners with 5px radius
- **Transition Type**: Horizontal movement until event date, then vertical shift
- **Curve Type**: Cubic Bezier curves for smooth transitions

## 7. Sorting and Positioning Requirements

### 7.1 Kidnapped Living Lane Sorting
- **Primary Sort**: Release status (released hostages first)
- **Secondary Sort**: Release date (earliest first)
- **Tertiary Sort**: Name (alphabetical)
- **Result**: Earliest releases at top, still captive at bottom

### 7.2 Other Lane Sorting
- **Default Logic**: Living status, then release date, then name
- **Consistency**: Maintain same hostage position throughout their journey

### 7.3 Position Caching
- **Requirement**: Consistent vertical position for each hostage within each lane
- **Implementation**: Cache positions to prevent jumping between redraws

## 8. Interactivity Requirements

### 8.1 Tooltip Information
- **Trigger**: Mouse hover over any line
- **Content**: 
  - Hostage name (Hebrew and English)
  - Current status
  - Key dates (kidnapping, release, death)
  - Circumstances
- **Style**: Dark background, white text, positioned near cursor

### 8.2 Highlighting
- **Trigger**: Mouse hover
- **Effect**: Highlight hovered line, dim others slightly
- **Duration**: Immediate on/off

## 9. Responsive Design Requirements

### 9.1 Minimum Dimensions
- **Width**: 800px minimum
- **Height**: 600px minimum
- **Aspect Ratio**: Maintain proportional scaling

### 9.2 Scaling Behavior
- **Text**: Scale proportionally with container
- **Line Spacing**: Maintain minimum 2.5px spacing regardless of scale
- **Labels**: Remain readable at all sizes

## 10. Performance Requirements

### 10.1 Loading Performance
- **Data Processing**: Complete within 2 seconds
- **Initial Render**: Complete within 3 seconds
- **Line Count**: Support up to 500 individual hostage lines

### 10.2 Interaction Performance
- **Tooltip Response**: < 100ms
- **Hover Effects**: < 50ms
- **Smooth Transitions**: 60fps during animations

## 11. Accessibility Requirements

### 11.1 Language Support
- **Primary Language**: Hebrew (RTL)
- **Character Encoding**: UTF-8
- **Font**: Support for Hebrew character sets

### 11.2 Visual Accessibility
- **Color Contrast**: Minimum 4.5:1 ratio for text
- **Line Thickness**: Minimum 1.5px for visibility
- **Pattern Differentiation**: Solid vs dashed patterns for living/deceased

## 12. Browser Compatibility

### 12.1 Supported Browsers
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### 12.2 Technology Stack
- **D3.js**: v7.x for data visualization
- **SVG**: For vector graphics rendering
- **JavaScript**: ES6+ features

## 13. Data Quality Requirements

### 13.1 Validation Rules
- **Date Format**: ISO 8601 or MM/DD/YYYY
- **Required Fields**: Name, initial status
- **Data Consistency**: Status field must align with date fields

### 13.2 Error Handling
- **Invalid Dates**: Default to known dates or exclude from transitions
- **Missing Data**: Use fallback values (e.g., default release date for confirmed releases)
- **Corrupted Records**: Log errors but continue processing other records

## 14. Future Considerations

### 14.1 Scalability
- **Data Growth**: Support for additional hostages
- **New Status Types**: Extensible lane structure
- **Historical Data**: Support for multiple time periods

### 14.2 Enhancement Opportunities
- **Animation**: Smooth transitions showing progression over time
- **Filtering**: Ability to filter by status, time period, or circumstances
- **Export**: SVG/PNG export capabilities
- **Print Optimization**: Print-friendly layouts

## 15. Acceptance Criteria

### 15.1 Visual Quality
- [ ] All 240+ hostage lines are visible and distinct
- [ ] No overlap between released and kidnapped sections
- [ ] Compact spacing in kidnapped living lane (no sparse appearance)
- [ ] Clear visual hierarchy with proper color coding
- [ ] Hebrew text displays correctly in RTL layout

### 15.2 Functional Requirements
- [ ] Lines transition accurately on correct dates
- [ ] Sorting in kidnapped living lane shows released first, captive last
- [ ] Tooltips show correct information for each hostage
- [ ] Responsive design works across different screen sizes
- [ ] All data from CSV is accurately represented

### 15.3 Performance Criteria
- [ ] Page loads within 3 seconds
- [ ] No JavaScript errors in console
- [ ] Smooth hover interactions
- [ ] Consistent line positioning across page refreshes
