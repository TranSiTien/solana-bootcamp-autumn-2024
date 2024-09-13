"use client";

import useAnchorProvider from "@/hooks/use-anchor-provider";
import TodoProgram from "@/lib/todo-program";
import { Center, Flex, List, Spinner, Text, Toast, useToast } from "@chakra-ui/react";
import { IdlAccounts } from "@coral-xyz/anchor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IDL } from "../../../target/types/todo_app";
import TodoItem from "./todo-item";
import { PublicKey } from "@solana/web3.js";

export default function TodoList({
  profile,
}: {
  profile: IdlAccounts<typeof IDL>["profile"];
}) {
  const toast = useToast();
  const provider = useAnchorProvider();
  const queryClient = useQueryClient();

  const { data: todos, isLoading } = useQuery({
    queryKey: ["todos", profile.key.toBase58(), profile.todoCount],
    enabled: !!profile,
    queryFn: () => new TodoProgram(provider).fetchTodos(profile),
  });

  const toggleTodoMutation = useMutation({
      mutationFn: async (todoPubKey: PublicKey) => {
        const program = new TodoProgram(provider);
        const tx = await program.toggleTodoStatus(todoPubKey);
        const signature = await provider.sendAndConfirm(tx);
        console.log("publicKey", todoPubKey.toBase58());

        return signature;
      },
      onSuccess: (tx) => {
        console.log(tx);
        toast({
          title: "Transaction sent",
          status: "success",
        });

        queryClient.invalidateQueries({
          queryKey: ["todos", profile.key.toBase58(), profile.todoCount]
        });
      },
    });

  const toggleTodo = (todoPubKey: PublicKey) => {
    toggleTodoMutation.mutate(todoPubKey);
  };

  if (isLoading) {
    return (
      <Center as={Flex} direction="column" gap={4} py={8}>
        <Spinner size="xl" colorScheme="blue" />
        <Text>Loading...</Text>
      </Center>
    );
  }

  console.log("todos", todos?.length);

  return (
    <List>
      {todos?.map((todo, idx) => (
        console.log("todo.data.content", todo.data.content),
        console.log("todo.data.completed", todo.data.completed),
        <TodoItem onToggle={() => toggleTodo(todo.publicKey)} key={idx} content={todo.data.content} completed={todo.data.completed} />
      ))}
    </List>
  );
}
