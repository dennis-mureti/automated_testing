export const assertTodoExists = (todos, title) => {
  const found = todos.some((todo) => todo.title === title);
  return found ? null : `Todo with title "${title}" not found`;
};

export const assertTodoCompleted = (todos, title) => {
  const todo = todos.find((todo) => todo.title === title);
  return todo && todo.completed
    ? null
    : `Todo "${title}" is not marked as completed`;
};

export const assertTodoDeleted = (todos, title) => {
  const found = todos.some((todo) => todo.title === title);
  return found ? `Todo with title "${title}" still exists` : null;
};

export const assertTodoUpdated = (todos, oldTitle, newTitle) => {
  const todo = todos.find((todo) => todo.title === newTitle);
  return todo
    ? null
    : `Todo was not updated from "${oldTitle}" to "${newTitle}"`;
};
