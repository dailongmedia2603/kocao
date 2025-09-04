import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';

type EditableFileNameProps = {
  fileId: string;
  initialName: string;
  queryKey: (string | null | undefined)[];
};

export const EditableFileName = ({ fileId, initialName, queryKey }: EditableFileNameProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase.rpc('update_koc_file_name', {
        file_id: fileId,
        new_name: newName,
      });
      if (error) throw error;
      return newName;
    },
    onSuccess: (newName) => {
      queryClient.invalidateQueries({ queryKey });
      showSuccess('Đổi tên tệp thành công!');
      setIsEditing(false);
    },
    onError: (error: Error) => {
      showError(`Lỗi đổi tên: ${error.message}`);
      setName(initialName); // Revert on error
      setIsEditing(false);
    },
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (name.trim() && name !== initialName) {
      renameMutation.mutate(name);
    } else {
      setName(initialName);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setName(initialName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-7 text-sm"
        disabled={renameMutation.isPending}
      />
    );
  }

  return (
    <p
      className="font-semibold text-sm truncate cursor-pointer hover:text-primary"
      title={name}
      onClick={() => setIsEditing(true)}
    >
      {name}
    </p>
  );
};