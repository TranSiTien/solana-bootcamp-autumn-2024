"use client";

import { Checkbox, ListItem } from "@chakra-ui/react";
import { useCallback } from "react";

export default function TodoItem({
  content,
  completed,
  onToggle,
}: {
  content: string;
  completed?: boolean;
  onToggle: () => void;
}) {
  const handleToggle = useCallback(() => {
    console.log("onToggle", onToggle);
    onToggle();
  }, [onToggle]);
  console.log("completed", completed);
  return (
    <ListItem borderBottomColor="gray.500" borderBottomWidth="1px" py={4}>
      <Checkbox
        isChecked={completed}
        onChange={handleToggle}
        sx={{
          textDecoration: completed ? "line-through" : "initial",
        }}
      >
        {content}
      </Checkbox>
    </ListItem>
  );
}
