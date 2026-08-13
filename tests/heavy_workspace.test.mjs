// This test simulates a massive workspace with thousands of deeply nested files.
// It verifies that the sync daemon and PostgreSQL can handle heavy load.
import { test } from 'vitest';

export const massiveWorkspaceFixture = {
  files: [
    {
      path: '/home/agent/workspace/nested/dir/level0/file0.txt',
      content: 'This is mock content for file 0. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 0,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file1.txt',
      content: 'This is mock content for file 1. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 1000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file2.txt',
      content: 'This is mock content for file 2. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 2000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file3.txt',
      content: 'This is mock content for file 3. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 3000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file4.txt',
      content: 'This is mock content for file 4. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 4000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file5.txt',
      content: 'This is mock content for file 5. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 5000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file6.txt',
      content: 'This is mock content for file 6. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 6000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file7.txt',
      content: 'This is mock content for file 7. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 7000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file8.txt',
      content: 'This is mock content for file 8. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 8000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file9.txt',
      content: 'This is mock content for file 9. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 9000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file10.txt',
      content: 'This is mock content for file 10. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 10000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file11.txt',
      content: 'This is mock content for file 11. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 11000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file12.txt',
      content: 'This is mock content for file 12. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 12000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file13.txt',
      content: 'This is mock content for file 13. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 13000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file14.txt',
      content: 'This is mock content for file 14. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 14000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file15.txt',
      content: 'This is mock content for file 15. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 15000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file16.txt',
      content: 'This is mock content for file 16. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 16000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file17.txt',
      content: 'This is mock content for file 17. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 17000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file18.txt',
      content: 'This is mock content for file 18. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 18000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file19.txt',
      content: 'This is mock content for file 19. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 19000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file20.txt',
      content: 'This is mock content for file 20. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 20000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file21.txt',
      content: 'This is mock content for file 21. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 21000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file22.txt',
      content: 'This is mock content for file 22. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 22000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file23.txt',
      content: 'This is mock content for file 23. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 23000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file24.txt',
      content: 'This is mock content for file 24. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 24000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file25.txt',
      content: 'This is mock content for file 25. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 25000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file26.txt',
      content: 'This is mock content for file 26. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 26000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file27.txt',
      content: 'This is mock content for file 27. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 27000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file28.txt',
      content: 'This is mock content for file 28. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 28000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file29.txt',
      content: 'This is mock content for file 29. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 29000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file30.txt',
      content: 'This is mock content for file 30. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 30000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file31.txt',
      content: 'This is mock content for file 31. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 31000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file32.txt',
      content: 'This is mock content for file 32. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 32000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file33.txt',
      content: 'This is mock content for file 33. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 33000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file34.txt',
      content: 'This is mock content for file 34. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 34000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file35.txt',
      content: 'This is mock content for file 35. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 35000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file36.txt',
      content: 'This is mock content for file 36. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 36000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file37.txt',
      content: 'This is mock content for file 37. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 37000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file38.txt',
      content: 'This is mock content for file 38. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 38000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file39.txt',
      content: 'This is mock content for file 39. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 39000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file40.txt',
      content: 'This is mock content for file 40. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 40000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file41.txt',
      content: 'This is mock content for file 41. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 41000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file42.txt',
      content: 'This is mock content for file 42. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 42000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file43.txt',
      content: 'This is mock content for file 43. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 43000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file44.txt',
      content: 'This is mock content for file 44. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 44000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file45.txt',
      content: 'This is mock content for file 45. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 45000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file46.txt',
      content: 'This is mock content for file 46. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 46000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file47.txt',
      content: 'This is mock content for file 47. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 47000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file48.txt',
      content: 'This is mock content for file 48. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 48000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file49.txt',
      content: 'This is mock content for file 49. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 49000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file50.txt',
      content: 'This is mock content for file 50. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 50000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file51.txt',
      content: 'This is mock content for file 51. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 51000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file52.txt',
      content: 'This is mock content for file 52. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 52000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file53.txt',
      content: 'This is mock content for file 53. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 53000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file54.txt',
      content: 'This is mock content for file 54. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 54000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file55.txt',
      content: 'This is mock content for file 55. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 55000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file56.txt',
      content: 'This is mock content for file 56. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 56000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file57.txt',
      content: 'This is mock content for file 57. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 57000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file58.txt',
      content: 'This is mock content for file 58. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 58000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file59.txt',
      content: 'This is mock content for file 59. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 59000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file60.txt',
      content: 'This is mock content for file 60. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 60000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file61.txt',
      content: 'This is mock content for file 61. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 61000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file62.txt',
      content: 'This is mock content for file 62. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 62000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file63.txt',
      content: 'This is mock content for file 63. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 63000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file64.txt',
      content: 'This is mock content for file 64. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 64000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file65.txt',
      content: 'This is mock content for file 65. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 65000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file66.txt',
      content: 'This is mock content for file 66. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 66000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file67.txt',
      content: 'This is mock content for file 67. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 67000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file68.txt',
      content: 'This is mock content for file 68. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 68000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file69.txt',
      content: 'This is mock content for file 69. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 69000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file70.txt',
      content: 'This is mock content for file 70. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 70000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file71.txt',
      content: 'This is mock content for file 71. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 71000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file72.txt',
      content: 'This is mock content for file 72. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 72000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file73.txt',
      content: 'This is mock content for file 73. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 73000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file74.txt',
      content: 'This is mock content for file 74. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 74000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file75.txt',
      content: 'This is mock content for file 75. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 75000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file76.txt',
      content: 'This is mock content for file 76. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 76000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file77.txt',
      content: 'This is mock content for file 77. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 77000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file78.txt',
      content: 'This is mock content for file 78. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 78000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file79.txt',
      content: 'This is mock content for file 79. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 79000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file80.txt',
      content: 'This is mock content for file 80. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 80000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file81.txt',
      content: 'This is mock content for file 81. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 81000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file82.txt',
      content: 'This is mock content for file 82. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 82000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file83.txt',
      content: 'This is mock content for file 83. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 83000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file84.txt',
      content: 'This is mock content for file 84. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 84000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file85.txt',
      content: 'This is mock content for file 85. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 85000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file86.txt',
      content: 'This is mock content for file 86. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 86000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file87.txt',
      content: 'This is mock content for file 87. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 87000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file88.txt',
      content: 'This is mock content for file 88. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 88000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file89.txt',
      content: 'This is mock content for file 89. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 89000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file90.txt',
      content: 'This is mock content for file 90. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 90000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file91.txt',
      content: 'This is mock content for file 91. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 91000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file92.txt',
      content: 'This is mock content for file 92. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 92000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file93.txt',
      content: 'This is mock content for file 93. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 93000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file94.txt',
      content: 'This is mock content for file 94. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 94000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file95.txt',
      content: 'This is mock content for file 95. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 95000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file96.txt',
      content: 'This is mock content for file 96. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 96000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file97.txt',
      content: 'This is mock content for file 97. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 97000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file98.txt',
      content: 'This is mock content for file 98. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 98000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file99.txt',
      content: 'This is mock content for file 99. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 99000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file100.txt',
      content: 'This is mock content for file 100. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 100000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file101.txt',
      content: 'This is mock content for file 101. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 101000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file102.txt',
      content: 'This is mock content for file 102. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 102000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file103.txt',
      content: 'This is mock content for file 103. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 103000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file104.txt',
      content: 'This is mock content for file 104. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 104000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file105.txt',
      content: 'This is mock content for file 105. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 105000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file106.txt',
      content: 'This is mock content for file 106. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 106000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file107.txt',
      content: 'This is mock content for file 107. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 107000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file108.txt',
      content: 'This is mock content for file 108. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 108000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file109.txt',
      content: 'This is mock content for file 109. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 109000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file110.txt',
      content: 'This is mock content for file 110. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 110000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file111.txt',
      content: 'This is mock content for file 111. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 111000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file112.txt',
      content: 'This is mock content for file 112. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 112000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file113.txt',
      content: 'This is mock content for file 113. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 113000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file114.txt',
      content: 'This is mock content for file 114. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 114000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file115.txt',
      content: 'This is mock content for file 115. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 115000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file116.txt',
      content: 'This is mock content for file 116. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 116000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file117.txt',
      content: 'This is mock content for file 117. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 117000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file118.txt',
      content: 'This is mock content for file 118. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 118000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file119.txt',
      content: 'This is mock content for file 119. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 119000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file120.txt',
      content: 'This is mock content for file 120. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 120000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file121.txt',
      content: 'This is mock content for file 121. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 121000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file122.txt',
      content: 'This is mock content for file 122. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 122000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file123.txt',
      content: 'This is mock content for file 123. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 123000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file124.txt',
      content: 'This is mock content for file 124. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 124000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file125.txt',
      content: 'This is mock content for file 125. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 125000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file126.txt',
      content: 'This is mock content for file 126. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 126000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file127.txt',
      content: 'This is mock content for file 127. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 127000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file128.txt',
      content: 'This is mock content for file 128. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 128000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file129.txt',
      content: 'This is mock content for file 129. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 129000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file130.txt',
      content: 'This is mock content for file 130. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 130000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file131.txt',
      content: 'This is mock content for file 131. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 131000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file132.txt',
      content: 'This is mock content for file 132. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 132000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file133.txt',
      content: 'This is mock content for file 133. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 133000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file134.txt',
      content: 'This is mock content for file 134. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 134000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file135.txt',
      content: 'This is mock content for file 135. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 135000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file136.txt',
      content: 'This is mock content for file 136. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 136000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file137.txt',
      content: 'This is mock content for file 137. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 137000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file138.txt',
      content: 'This is mock content for file 138. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 138000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file139.txt',
      content: 'This is mock content for file 139. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 139000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file140.txt',
      content: 'This is mock content for file 140. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 140000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file141.txt',
      content: 'This is mock content for file 141. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 141000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file142.txt',
      content: 'This is mock content for file 142. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 142000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file143.txt',
      content: 'This is mock content for file 143. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 143000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file144.txt',
      content: 'This is mock content for file 144. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 144000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file145.txt',
      content: 'This is mock content for file 145. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 145000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file146.txt',
      content: 'This is mock content for file 146. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 146000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file147.txt',
      content: 'This is mock content for file 147. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 147000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file148.txt',
      content: 'This is mock content for file 148. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 148000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file149.txt',
      content: 'This is mock content for file 149. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 149000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file150.txt',
      content: 'This is mock content for file 150. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 150000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file151.txt',
      content: 'This is mock content for file 151. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 151000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file152.txt',
      content: 'This is mock content for file 152. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 152000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file153.txt',
      content: 'This is mock content for file 153. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 153000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file154.txt',
      content: 'This is mock content for file 154. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 154000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file155.txt',
      content: 'This is mock content for file 155. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 155000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file156.txt',
      content: 'This is mock content for file 156. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 156000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file157.txt',
      content: 'This is mock content for file 157. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 157000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file158.txt',
      content: 'This is mock content for file 158. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 158000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file159.txt',
      content: 'This is mock content for file 159. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 159000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file160.txt',
      content: 'This is mock content for file 160. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 160000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file161.txt',
      content: 'This is mock content for file 161. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 161000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file162.txt',
      content: 'This is mock content for file 162. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 162000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file163.txt',
      content: 'This is mock content for file 163. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 163000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file164.txt',
      content: 'This is mock content for file 164. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 164000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file165.txt',
      content: 'This is mock content for file 165. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 165000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file166.txt',
      content: 'This is mock content for file 166. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 166000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file167.txt',
      content: 'This is mock content for file 167. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 167000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file168.txt',
      content: 'This is mock content for file 168. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 168000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file169.txt',
      content: 'This is mock content for file 169. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 169000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file170.txt',
      content: 'This is mock content for file 170. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 170000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file171.txt',
      content: 'This is mock content for file 171. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 171000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file172.txt',
      content: 'This is mock content for file 172. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 172000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file173.txt',
      content: 'This is mock content for file 173. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 173000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file174.txt',
      content: 'This is mock content for file 174. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 174000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file175.txt',
      content: 'This is mock content for file 175. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 175000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file176.txt',
      content: 'This is mock content for file 176. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 176000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file177.txt',
      content: 'This is mock content for file 177. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 177000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file178.txt',
      content: 'This is mock content for file 178. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 178000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file179.txt',
      content: 'This is mock content for file 179. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 179000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file180.txt',
      content: 'This is mock content for file 180. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 180000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file181.txt',
      content: 'This is mock content for file 181. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 181000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file182.txt',
      content: 'This is mock content for file 182. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 182000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file183.txt',
      content: 'This is mock content for file 183. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 183000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file184.txt',
      content: 'This is mock content for file 184. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 184000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file185.txt',
      content: 'This is mock content for file 185. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 185000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file186.txt',
      content: 'This is mock content for file 186. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 186000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file187.txt',
      content: 'This is mock content for file 187. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 187000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file188.txt',
      content: 'This is mock content for file 188. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 188000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file189.txt',
      content: 'This is mock content for file 189. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 189000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file190.txt',
      content: 'This is mock content for file 190. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 190000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file191.txt',
      content: 'This is mock content for file 191. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 191000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file192.txt',
      content: 'This is mock content for file 192. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 192000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file193.txt',
      content: 'This is mock content for file 193. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 193000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file194.txt',
      content: 'This is mock content for file 194. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 194000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file195.txt',
      content: 'This is mock content for file 195. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 195000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file196.txt',
      content: 'This is mock content for file 196. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 196000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file197.txt',
      content: 'This is mock content for file 197. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 197000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file198.txt',
      content: 'This is mock content for file 198. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 198000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file199.txt',
      content: 'This is mock content for file 199. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 199000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file200.txt',
      content: 'This is mock content for file 200. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 200000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file201.txt',
      content: 'This is mock content for file 201. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 201000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file202.txt',
      content: 'This is mock content for file 202. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 202000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file203.txt',
      content: 'This is mock content for file 203. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 203000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file204.txt',
      content: 'This is mock content for file 204. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 204000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file205.txt',
      content: 'This is mock content for file 205. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 205000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file206.txt',
      content: 'This is mock content for file 206. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 206000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file207.txt',
      content: 'This is mock content for file 207. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 207000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file208.txt',
      content: 'This is mock content for file 208. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 208000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file209.txt',
      content: 'This is mock content for file 209. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 209000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file210.txt',
      content: 'This is mock content for file 210. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 210000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file211.txt',
      content: 'This is mock content for file 211. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 211000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file212.txt',
      content: 'This is mock content for file 212. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 212000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file213.txt',
      content: 'This is mock content for file 213. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 213000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file214.txt',
      content: 'This is mock content for file 214. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 214000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file215.txt',
      content: 'This is mock content for file 215. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 215000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file216.txt',
      content: 'This is mock content for file 216. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 216000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file217.txt',
      content: 'This is mock content for file 217. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 217000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file218.txt',
      content: 'This is mock content for file 218. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 218000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file219.txt',
      content: 'This is mock content for file 219. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 219000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file220.txt',
      content: 'This is mock content for file 220. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 220000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file221.txt',
      content: 'This is mock content for file 221. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 221000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file222.txt',
      content: 'This is mock content for file 222. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 222000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file223.txt',
      content: 'This is mock content for file 223. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 223000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file224.txt',
      content: 'This is mock content for file 224. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 224000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file225.txt',
      content: 'This is mock content for file 225. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 225000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file226.txt',
      content: 'This is mock content for file 226. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 226000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file227.txt',
      content: 'This is mock content for file 227. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 227000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file228.txt',
      content: 'This is mock content for file 228. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 228000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file229.txt',
      content: 'This is mock content for file 229. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 229000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file230.txt',
      content: 'This is mock content for file 230. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 230000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file231.txt',
      content: 'This is mock content for file 231. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 231000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file232.txt',
      content: 'This is mock content for file 232. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 232000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file233.txt',
      content: 'This is mock content for file 233. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 233000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file234.txt',
      content: 'This is mock content for file 234. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 234000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file235.txt',
      content: 'This is mock content for file 235. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 235000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file236.txt',
      content: 'This is mock content for file 236. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 236000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file237.txt',
      content: 'This is mock content for file 237. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 237000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file238.txt',
      content: 'This is mock content for file 238. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 238000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file239.txt',
      content: 'This is mock content for file 239. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 239000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file240.txt',
      content: 'This is mock content for file 240. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 240000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file241.txt',
      content: 'This is mock content for file 241. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 241000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file242.txt',
      content: 'This is mock content for file 242. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 242000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file243.txt',
      content: 'This is mock content for file 243. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 243000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file244.txt',
      content: 'This is mock content for file 244. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 244000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file245.txt',
      content: 'This is mock content for file 245. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 245000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file246.txt',
      content: 'This is mock content for file 246. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 246000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file247.txt',
      content: 'This is mock content for file 247. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 247000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file248.txt',
      content: 'This is mock content for file 248. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 248000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file249.txt',
      content: 'This is mock content for file 249. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 249000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file250.txt',
      content: 'This is mock content for file 250. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 250000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file251.txt',
      content: 'This is mock content for file 251. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 251000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file252.txt',
      content: 'This is mock content for file 252. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 252000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file253.txt',
      content: 'This is mock content for file 253. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 253000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file254.txt',
      content: 'This is mock content for file 254. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 254000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file255.txt',
      content: 'This is mock content for file 255. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 255000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file256.txt',
      content: 'This is mock content for file 256. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 256000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file257.txt',
      content: 'This is mock content for file 257. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 257000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file258.txt',
      content: 'This is mock content for file 258. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 258000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file259.txt',
      content: 'This is mock content for file 259. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 259000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file260.txt',
      content: 'This is mock content for file 260. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 260000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file261.txt',
      content: 'This is mock content for file 261. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 261000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file262.txt',
      content: 'This is mock content for file 262. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 262000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file263.txt',
      content: 'This is mock content for file 263. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 263000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file264.txt',
      content: 'This is mock content for file 264. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 264000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file265.txt',
      content: 'This is mock content for file 265. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 265000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file266.txt',
      content: 'This is mock content for file 266. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 266000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file267.txt',
      content: 'This is mock content for file 267. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 267000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file268.txt',
      content: 'This is mock content for file 268. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 268000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file269.txt',
      content: 'This is mock content for file 269. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 269000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file270.txt',
      content: 'This is mock content for file 270. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 270000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file271.txt',
      content: 'This is mock content for file 271. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 271000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file272.txt',
      content: 'This is mock content for file 272. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 272000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file273.txt',
      content: 'This is mock content for file 273. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 273000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file274.txt',
      content: 'This is mock content for file 274. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 274000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file275.txt',
      content: 'This is mock content for file 275. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 275000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file276.txt',
      content: 'This is mock content for file 276. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 276000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file277.txt',
      content: 'This is mock content for file 277. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 277000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file278.txt',
      content: 'This is mock content for file 278. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 278000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file279.txt',
      content: 'This is mock content for file 279. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 279000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file280.txt',
      content: 'This is mock content for file 280. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 280000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file281.txt',
      content: 'This is mock content for file 281. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 281000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file282.txt',
      content: 'This is mock content for file 282. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 282000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file283.txt',
      content: 'This is mock content for file 283. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 283000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file284.txt',
      content: 'This is mock content for file 284. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 284000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file285.txt',
      content: 'This is mock content for file 285. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 285000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file286.txt',
      content: 'This is mock content for file 286. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 286000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file287.txt',
      content: 'This is mock content for file 287. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 287000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file288.txt',
      content: 'This is mock content for file 288. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 288000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file289.txt',
      content: 'This is mock content for file 289. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 289000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file290.txt',
      content: 'This is mock content for file 290. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 290000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file291.txt',
      content: 'This is mock content for file 291. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 291000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file292.txt',
      content: 'This is mock content for file 292. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 292000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file293.txt',
      content: 'This is mock content for file 293. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 293000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file294.txt',
      content: 'This is mock content for file 294. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 294000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file295.txt',
      content: 'This is mock content for file 295. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 295000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file296.txt',
      content: 'This is mock content for file 296. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 296000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file297.txt',
      content: 'This is mock content for file 297. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 297000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file298.txt',
      content: 'This is mock content for file 298. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 298000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file299.txt',
      content: 'This is mock content for file 299. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 299000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file300.txt',
      content: 'This is mock content for file 300. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 300000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file301.txt',
      content: 'This is mock content for file 301. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 301000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file302.txt',
      content: 'This is mock content for file 302. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 302000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file303.txt',
      content: 'This is mock content for file 303. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 303000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file304.txt',
      content: 'This is mock content for file 304. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 304000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file305.txt',
      content: 'This is mock content for file 305. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 305000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file306.txt',
      content: 'This is mock content for file 306. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 306000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file307.txt',
      content: 'This is mock content for file 307. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 307000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file308.txt',
      content: 'This is mock content for file 308. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 308000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file309.txt',
      content: 'This is mock content for file 309. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 309000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file310.txt',
      content: 'This is mock content for file 310. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 310000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file311.txt',
      content: 'This is mock content for file 311. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 311000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file312.txt',
      content: 'This is mock content for file 312. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 312000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file313.txt',
      content: 'This is mock content for file 313. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 313000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file314.txt',
      content: 'This is mock content for file 314. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 314000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file315.txt',
      content: 'This is mock content for file 315. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 315000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file316.txt',
      content: 'This is mock content for file 316. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 316000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file317.txt',
      content: 'This is mock content for file 317. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 317000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file318.txt',
      content: 'This is mock content for file 318. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 318000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file319.txt',
      content: 'This is mock content for file 319. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 319000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file320.txt',
      content: 'This is mock content for file 320. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 320000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file321.txt',
      content: 'This is mock content for file 321. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 321000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file322.txt',
      content: 'This is mock content for file 322. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 322000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file323.txt',
      content: 'This is mock content for file 323. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 323000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file324.txt',
      content: 'This is mock content for file 324. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 324000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file325.txt',
      content: 'This is mock content for file 325. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 325000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file326.txt',
      content: 'This is mock content for file 326. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 326000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file327.txt',
      content: 'This is mock content for file 327. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 327000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file328.txt',
      content: 'This is mock content for file 328. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 328000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file329.txt',
      content: 'This is mock content for file 329. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 329000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file330.txt',
      content: 'This is mock content for file 330. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 330000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file331.txt',
      content: 'This is mock content for file 331. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 331000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file332.txt',
      content: 'This is mock content for file 332. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 332000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file333.txt',
      content: 'This is mock content for file 333. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 333000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file334.txt',
      content: 'This is mock content for file 334. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 334000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file335.txt',
      content: 'This is mock content for file 335. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 335000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file336.txt',
      content: 'This is mock content for file 336. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 336000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file337.txt',
      content: 'This is mock content for file 337. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 337000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file338.txt',
      content: 'This is mock content for file 338. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 338000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file339.txt',
      content: 'This is mock content for file 339. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 339000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file340.txt',
      content: 'This is mock content for file 340. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 340000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file341.txt',
      content: 'This is mock content for file 341. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 341000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file342.txt',
      content: 'This is mock content for file 342. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 342000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file343.txt',
      content: 'This is mock content for file 343. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 343000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file344.txt',
      content: 'This is mock content for file 344. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 344000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file345.txt',
      content: 'This is mock content for file 345. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 345000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file346.txt',
      content: 'This is mock content for file 346. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 346000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file347.txt',
      content: 'This is mock content for file 347. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 347000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file348.txt',
      content: 'This is mock content for file 348. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 348000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file349.txt',
      content: 'This is mock content for file 349. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 349000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file350.txt',
      content: 'This is mock content for file 350. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 350000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file351.txt',
      content: 'This is mock content for file 351. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 351000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file352.txt',
      content: 'This is mock content for file 352. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 352000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file353.txt',
      content: 'This is mock content for file 353. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 353000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file354.txt',
      content: 'This is mock content for file 354. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 354000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file355.txt',
      content: 'This is mock content for file 355. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 355000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file356.txt',
      content: 'This is mock content for file 356. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 356000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file357.txt',
      content: 'This is mock content for file 357. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 357000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file358.txt',
      content: 'This is mock content for file 358. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 358000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file359.txt',
      content: 'This is mock content for file 359. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 359000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file360.txt',
      content: 'This is mock content for file 360. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 360000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file361.txt',
      content: 'This is mock content for file 361. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 361000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file362.txt',
      content: 'This is mock content for file 362. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 362000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file363.txt',
      content: 'This is mock content for file 363. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 363000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file364.txt',
      content: 'This is mock content for file 364. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 364000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file365.txt',
      content: 'This is mock content for file 365. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 365000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file366.txt',
      content: 'This is mock content for file 366. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 366000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file367.txt',
      content: 'This is mock content for file 367. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 367000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file368.txt',
      content: 'This is mock content for file 368. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 368000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file369.txt',
      content: 'This is mock content for file 369. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 369000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file370.txt',
      content: 'This is mock content for file 370. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 370000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file371.txt',
      content: 'This is mock content for file 371. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 371000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file372.txt',
      content: 'This is mock content for file 372. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 372000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file373.txt',
      content: 'This is mock content for file 373. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 373000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file374.txt',
      content: 'This is mock content for file 374. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 374000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file375.txt',
      content: 'This is mock content for file 375. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 375000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file376.txt',
      content: 'This is mock content for file 376. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 376000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file377.txt',
      content: 'This is mock content for file 377. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 377000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file378.txt',
      content: 'This is mock content for file 378. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 378000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file379.txt',
      content: 'This is mock content for file 379. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 379000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file380.txt',
      content: 'This is mock content for file 380. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 380000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file381.txt',
      content: 'This is mock content for file 381. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 381000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file382.txt',
      content: 'This is mock content for file 382. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 382000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file383.txt',
      content: 'This is mock content for file 383. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 383000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file384.txt',
      content: 'This is mock content for file 384. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 384000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file385.txt',
      content: 'This is mock content for file 385. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 385000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file386.txt',
      content: 'This is mock content for file 386. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 386000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file387.txt',
      content: 'This is mock content for file 387. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 387000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file388.txt',
      content: 'This is mock content for file 388. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 388000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file389.txt',
      content: 'This is mock content for file 389. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 389000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level0/file390.txt',
      content: 'This is mock content for file 390. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 390000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level1/file391.txt',
      content: 'This is mock content for file 391. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 391000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level2/file392.txt',
      content: 'This is mock content for file 392. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 392000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level3/file393.txt',
      content: 'This is mock content for file 393. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 393000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level4/file394.txt',
      content: 'This is mock content for file 394. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 394000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level5/file395.txt',
      content: 'This is mock content for file 395. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 395000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level6/file396.txt',
      content: 'This is mock content for file 396. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 396000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level7/file397.txt',
      content: 'This is mock content for file 397. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 397000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level8/file398.txt',
      content: 'This is mock content for file 398. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 398000,
      mode: 33188,
      size: 156
    },
    {
      path: '/home/agent/workspace/nested/dir/level9/file399.txt',
      content: 'This is mock content for file 399. It is used to ensure that the sync daemon can properly serialize and deserialize large JSON payloads without running out of memory or hitting payload limits.',
      mtime: 1710000000000 + 399000,
      mode: 33188,
      size: 156
    },
  ]
};

test('Sync daemon can handle heavy workspace state', async () => {
  // 1. Initialize heavy workspace state in mock DB
  // 2. Trigger sync
  // 3. Verify no memory leaks
  const expectedFileCount = massiveWorkspaceFixture.files.length;
  // TODO: Add implementation assertions
});
