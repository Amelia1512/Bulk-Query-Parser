import tkinter as tk
from tkinter import filedialog, messagebox
import pandas as pd
from urllib.parse import parse_qs
import re
import string
import os

def col_letter_to_index(letter):
    letter = letter.upper()
    return sum((string.ascii_uppercase.index(c) + 1) * (26 ** i) for i, c in enumerate(reversed(letter))) - 1

def parse_query_string(qs):
    parsed = parse_qs(qs, keep_blank_values=True)
    # Flatten single-element lists
    return {k.lower(): v[0] for k, v in parsed.items()}

def process_file(filepath, column_letter, separate_items):
    df = pd.read_csv(filepath)
    col_index = col_letter_to_index(column_letter)
    
    if col_index >= len(df.columns):
        raise ValueError("Invalid column letter for the selected file.")

    parsed_rows = []
    all_keys = set()

    for _, row in df.iterrows():
        try:
            raw_qs = str(row.iloc[col_index])
            parsed = parse_query_string(raw_qs)

            # Collect itemX patterns
            item_data = {}
            max_index = 0
            for key in parsed:
                match = re.match(r"(item|amt|qty|dcnt)(\d+)", key)
                if match:
                    prefix, idx = match.groups()
                    idx = int(idx)
                    max_index = max(max_index, idx)
                    item_data.setdefault(idx, {})[prefix] = parsed[key]

            combined = {}
            # Collect non-item fields
            for k, v in parsed.items():
                if not re.match(r"(item|amt|qty|dcnt)\d+", k):
                    combined[k.lower()] = v

            # Handle item data
            if separate_items:
                itemSku = []
                itemUnitPrice = []
                itemQuantity = []
                itemDiscount = []

                for i in range(1, max_index + 1):
                    itemSku.append(item_data.get(i, {}).get("item", ""))
                    itemUnitPrice.append(item_data.get(i, {}).get("amt", ""))
                    itemQuantity.append(item_data.get(i, {}).get("qty", ""))
                    itemDiscount.append(item_data.get(i, {}).get("dcnt", ""))

                combined["itemSku"] = ";".join(itemSku)
                combined["itemUnitPrice"] = ";".join(itemUnitPrice)
                combined["itemQuantity"] = ";".join(itemQuantity)
                if any(d for d in itemDiscount):
                    combined["itemDiscount"] = ";".join(itemDiscount)
            else:
                items_combined = []
                for i in range(1, max_index + 1):
                    parts = [
                        item_data.get(i, {}).get("item", ""),
                        item_data.get(i, {}).get("amt", ""),
                        item_data.get(i, {}).get("qty", ""),
                        item_data.get(i, {}).get("dcnt", ""),
                    ]
                    items_combined.extend(parts)
                combined["items"] = ";".join(items_combined)

            parsed_rows.append(combined)
            all_keys.update(combined.keys())

        except Exception as e:
            print(f"Error parsing row: {e}")
            continue

    # Order columns alphabetically
    final_keys = sorted(all_keys, key=lambda x: x.lower())


    output_df = pd.DataFrame(parsed_rows)
    output_df = output_df.reindex(columns=final_keys)
    return output_df

# GUI Setup
def run_tool():
    filepath = filedialog.askopenfilename(filetypes=[("CSV Files", "*.csv")])
    if not filepath:
        return

    def process_and_save():
        column_letter = col_entry.get().strip()
        if not column_letter.isalpha():
            messagebox.showerror("Error", "Please enter a valid column letter (e.g., A, B, C).")
            return

        separate = separate_var.get()
        try:
            result_df = process_file(filepath, column_letter, separate)
            save_path = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV Files", "*.csv")],
                initialfile="parsed_output.csv"
            )
            if save_path:
                result_df.to_csv(save_path, index=False)
                messagebox.showinfo("Success", f"File saved as: {save_path}")
                window.destroy()
        except Exception as e:
            messagebox.showerror("Error", str(e))

    # GUI window
    window = tk.Tk()
    window.title("Amelia's Query Parser v1.0")

    tk.Label(window, text="Enter column letter of query string (e.g. A, B, C):").grid(row=0, column=0, padx=10, pady=5, sticky="w")
    col_entry = tk.Entry(window)
    col_entry.grid(row=0, column=1, padx=10, pady=5)

    separate_var = tk.BooleanVar()
    separate_cb = tk.Checkbutton(window, text="Separate item data (itemSku, itemUnitPrice, itemQuantity, itemDiscount)",
                                 variable=separate_var)
    separate_cb.grid(row=1, column=0, columnspan=2, padx=10, pady=5, sticky="w")

    run_btn = tk.Button(window, text="Run & Save", command=process_and_save)
    run_btn.grid(row=2, column=0, columnspan=2, pady=10)

    window.mainloop()

# Start the tool
if __name__ == "__main__":
    run_tool()
