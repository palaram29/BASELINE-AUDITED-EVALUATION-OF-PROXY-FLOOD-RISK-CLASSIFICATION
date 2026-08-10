from train_models import compare_models

train_file = "D:\\NSBM Final year - Research Paper\\Filter_Data\\New updated dataset\\train_dataset.csv"
test_file = "D:\\NSBM Final year - Research Paper\\Filter_Data\\New updated dataset\\test_dataset.csv"

results, best_model = compare_models(train_file, test_file)

print("\n===== MODEL COMPARISON =====")

for result in results:
    print(f"\nModel: {result['name']}")
    print(f"Accuracy: {result['accuracy']:.4f}")
    print(f"Precision: {result['precision']:.4f}")
    print(f"Recall: {result['recall']:.4f}")
    print(f"F1 Score: {result['f1']:.4f}")
    print(f"Training Time: {result['training_time']:.4f} sec")
    print(f"Prediction Time: {result['prediction_time']:.4f} sec")

print("\n============================")
print(f"Best Model: {best_model['name']}")